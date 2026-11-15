import { Build, IBuildCriterion } from '@civ-clone/core-city-build/Rules/Build';
import capitalizationRules, {
  CapitalizationConversionOptions,
  isBuildingCapitalization,
  isCapitalization,
  notBuyingCapitalization,
  payOut,
} from '../lib/capitalizationRules';
import { isBuying, linearBuyCost } from '@civ-clone/base-treasury/lib/buy';
import AvailableCityBuildItemsRegistry from '@civ-clone/core-city-build/AvailableCityBuildItemsRegistry';
import { BuildProgress } from '@civ-clone/core-city-build/Yields';
import BuildingComplete from '@civ-clone/core-city-build/Rules/BulidingComplete';
import Capitalization from '../Capitalization';
import City from '@civ-clone/core-city/City';
import CityBuild from '@civ-clone/core-city-build/CityBuild';
import CityBuildRegistry from '@civ-clone/core-city-build/CityBuildRegistry';
import CityImprovement from '@civ-clone/core-city-improvement/CityImprovement';
import Criterion from '@civ-clone/core-rule/Criterion';
import Effect from '@civ-clone/core-rule/Effect';
import PlayerTreasury from '@civ-clone/core-treasury/PlayerTreasury';
import PlayerTreasuryRegistry from '@civ-clone/core-treasury/PlayerTreasuryRegistry';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Spend from '@civ-clone/core-treasury/Rules/Spend';
import SpendCost from '@civ-clone/core-treasury/SpendCost';
import Yield from '@civ-clone/core-yield/Yield';
import { buildCost } from '@civ-clone/core-city-build/Rules/BuildCost';
import { expect } from 'chai';
import setUpCity from '@civ-clone/core-city/tests/lib/setUpCity';

class Gold extends Yield {}
class Temple extends CityImprovement {}
class Coinage extends Capitalization {}
class Barracks extends CityImprovement {}

const HOLD = 'test:city/hold/capitalization';

const setUp = async (
  options: Partial<CapitalizationConversionOptions> = {}
) => {
  const ruleRegistry = new RuleRegistry(),
    availableCityBuildItemsRegistry = new AvailableCityBuildItemsRegistry(),
    cityBuildRegistry = new CityBuildRegistry(),
    playerTreasuryRegistry = new PlayerTreasuryRegistry(),
    city: City = await setUpCity('city', ruleRegistry),
    cityBuild = new CityBuild(
      city,
      availableCityBuildItemsRegistry,
      ruleRegistry
    ),
    treasury = new PlayerTreasury(
      city.player(),
      Gold,
      cityBuildRegistry,
      ruleRegistry
    ),
    completed: unknown[] = [],
    available = { Barracks: true };

  cityBuildRegistry.register(cityBuild);
  playerTreasuryRegistry.register(treasury);
  availableCityBuildItemsRegistry.register(
    Temple,
    Barracks,
    options.Item ?? Capitalization
  );

  ruleRegistry.register(
    new Build(
      new Effect(
        (city: City, item: unknown): IBuildCriterion =>
          new Criterion(() => item !== Barracks || available.Barracks)
      )
    ),
    ...buildCost(Temple, 40),
    ...buildCost(Barracks, 30),
    new BuildingComplete(
      new Effect((cityBuild: CityBuild, built: unknown): void => {
        completed.push(built);
      })
    ),
    ...capitalizationRules(
      { playerTreasuryRegistry },
      { YieldType: Gold, idPrefix: 'test', ...options }
    )
  );

  return { available, cityBuild, completed, ruleRegistry, treasury };
};

// OpenCiv2 (github.com/richardpenman/civ2, `src/auto/city.cpp` `city_split_trade`): while a city builds
//  Capitalization, `total_shields - shield_support`, when above 0, is added to the city's tax, after the Marketplace
//  and Bank bonuses, so one for one; `city_process_production` never completes it (`improvement != IMP_CAPITALIZATION`).
describe('capitalizationRules', (): void => {
  it("turns each turn's production into gold, one for one, and never completes", async (): Promise<void> => {
    const { cityBuild, completed, treasury } = await setUp(),
      paid: number[] = [];

    cityBuild.build(Capitalization);

    [4, 7, 0, 12].forEach((production: number): void => {
      cityBuild.add(new BuildProgress(production));

      expect(cityBuild.check()).to.null;

      paid.push(treasury.value());
    });

    expect(paid).to.deep.equal([4, 11, 11, 23]);
    expect(cityBuild.progress().value()).to.equal(0);
    expect(cityBuild.building()!.item()).to.equal(Capitalization);
    expect(completed).to.deep.equal([]);
  });

  it("has no cost, and is held, with the `Hold` rule's id", async (): Promise<void> => {
    const { cityBuild } = await setUp();

    expect(cityBuild.heldFor(Capitalization)).to.deep.equal([HOLD]);

    cityBuild.build(Capitalization);

    expect(cityBuild.cost().value()).to.equal(0);
    expect(cityBuild.held()).to.deep.equal([HOLD]);
  });

  it("doesn't hold anything else", async (): Promise<void> => {
    const { cityBuild, completed } = await setUp();

    expect(cityBuild.heldFor(Temple)).to.deep.equal([]);

    cityBuild.build(Temple);
    cityBuild.add(new BuildProgress(40));
    cityBuild.check();

    expect(completed.length).to.equal(1);
    expect(completed[0]).to.instanceof(Temple);
  });

  // The progress a city has when it changes to Capitalization is paid out on the first turn. (The original leaves the
  //  box as it is, `city_process_production`: only the turn's net shields become gold.)
  it('pays out the progress it was changed to with, on the first turn', async (): Promise<void> => {
    const { cityBuild, treasury } = await setUp();

    cityBuild.build(Temple);
    cityBuild.add(new BuildProgress(30));
    cityBuild.check();

    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(5));
    cityBuild.check();

    expect(treasury.value()).to.equal(35);
    expect(cityBuild.progress().value()).to.equal(0);
  });

  // `city_process_disorder` only adds the city's tax to the treasury outside Anarchy.
  it("loses the production on a turn it doesn't pay", async (): Promise<void> => {
    let paying = false;

    const { cityBuild, treasury } = await setUp({
      pays: (): boolean => paying,
    });

    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(6));
    cityBuild.check();

    expect(treasury.value()).to.equal(0);
    expect(cityBuild.progress().value()).to.equal(0);

    paying = true;

    cityBuild.add(new BuildProgress(3));
    cityBuild.check();

    expect(treasury.value()).to.equal(3);
  });

  // The box is lost with the turn's production: here 30 from a half-built Temple. (The original keeps its box, and
  //  loses only the turn's shields, `city_process_production` and `city_process_disorder`.)
  it("loses the progress it was changed to with, on a first turn it doesn't pay", async (): Promise<void> => {
    const { cityBuild, treasury } = await setUp({
      pays: (): boolean => false,
    });

    cityBuild.build(Temple);
    cityBuild.add(new BuildProgress(30));
    cityBuild.check();

    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(5));
    cityBuild.check();

    expect(treasury.value()).to.equal(0);
    expect(cityBuild.progress().value()).to.equal(0);
  });

  it('pays out through `payOut`, which a ruleset can call from its own production step', async (): Promise<void> => {
    const { cityBuild, treasury } = await setUp(),
      registry = new PlayerTreasuryRegistry();

    registry.register(treasury);

    expect(
      payOut(
        cityBuild.city(),
        7,
        { playerTreasuryRegistry: registry },
        { YieldType: Gold }
      )
    ).to.equal(7);
    expect(
      payOut(
        cityBuild.city(),
        0,
        { playerTreasuryRegistry: registry },
        { YieldType: Gold }
      )
    ).to.equal(0);
    expect(
      payOut(
        cityBuild.city(),
        4,
        { playerTreasuryRegistry: registry },
        { YieldType: Gold, pays: () => false }
      )
    ).to.equal(0);
    expect(treasury.value()).to.equal(7);
  });

  // Capitalization never completes, so on its own the queue behind it would never be reached.
  it('moves on to the item queued after it, once the turn is paid out', async (): Promise<void> => {
    const { cityBuild, completed, treasury } = await setUp();

    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(6));
    cityBuild.check();

    expect(cityBuild.building()!.item()).to.equal(Capitalization);

    cityBuild.enqueue(Barracks);
    cityBuild.add(new BuildProgress(4));
    cityBuild.check();

    expect(treasury.value()).to.equal(10);
    expect(cityBuild.building()!.item()).to.equal(Barracks);
    expect(cityBuild.queued()).to.deep.equal([]);
    expect(cityBuild.progress().value()).to.equal(0);

    cityBuild.add(new BuildProgress(30));
    cityBuild.check();

    expect(completed.length).to.equal(1);
    expect(completed[0]).to.instanceof(Barracks);
    expect(treasury.value()).to.equal(10);
  });

  it('drops queued items the city can no longer build, and stays when none is left', async (): Promise<void> => {
    const { available, cityBuild } = await setUp();

    cityBuild.build(Capitalization);
    cityBuild.enqueue(Barracks);
    cityBuild.enqueue(Temple);
    cityBuild.enqueue(Barracks);

    available.Barracks = false;

    cityBuild.add(new BuildProgress(2));
    cityBuild.check();

    expect(cityBuild.building()!.item()).to.equal(Temple);
    expect(cityBuild.queued()).to.deep.equal([Barracks]);

    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(2));
    cityBuild.check();

    expect(cityBuild.building()!.item()).to.equal(Capitalization);
    expect(cityBuild.queued()).to.deep.equal([]);
  });

  it("works for a ruleset's subclass", async (): Promise<void> => {
    const { cityBuild, treasury } = await setUp({ Item: Coinage });

    expect(isCapitalization(Coinage)).to.true;
    expect(isCapitalization(Coinage, Coinage)).to.true;
    expect(isCapitalization(Capitalization, Coinage)).to.false;
    expect(isCapitalization(Temple)).to.false;

    cityBuild.build(Coinage);
    cityBuild.add(new BuildProgress(8));
    cityBuild.check();

    expect(isBuildingCapitalization(cityBuild)).to.true;
    expect(treasury.value()).to.equal(8);
  });
});

// `city_button_buy`: Capitalization can't be bought.
describe('buying', (): void => {
  const priced = (ruleRegistry: RuleRegistry, ...criteria: Criterion[]): void =>
    ruleRegistry.register(
      new Spend(
        ...criteria,
        new Effect(
          (cityBuild: CityBuild): SpendCost =>
            new SpendCost(Gold, linearBuyCost(2)(cityBuild.remaining()) + 10)
        )
      )
    );

  it("isn't offered by a `Spend` rule that asks base-treasury's `isBuying`", async (): Promise<void> => {
    const { cityBuild, ruleRegistry, treasury } = await setUp();

    priced(
      ruleRegistry,
      new Criterion((cityBuild: CityBuild): boolean =>
        isBuying(cityBuild, CityImprovement)
      )
    );

    treasury.set(100);
    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(3));

    expect(treasury.cost(cityBuild.city())).to.deep.equal([]);

    treasury.buy(cityBuild.city());

    expect(treasury.value()).to.equal(100);
    expect(cityBuild.progress().value()).to.equal(3);
  });

  it('is refused by `notBuyingCapitalization`', async (): Promise<void> => {
    const { cityBuild, ruleRegistry, treasury } = await setUp();

    priced(ruleRegistry, notBuyingCapitalization());

    treasury.set(100);
    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(3));

    expect(treasury.cost(cityBuild.city())).to.deep.equal([]);

    treasury.buy(cityBuild.city());

    expect(treasury.value()).to.equal(100);
    expect(cityBuild.progress().value()).to.equal(3);

    // Something else is still bought: 40 - 3 = 37 left, at 2 each, plus 10.
    cityBuild.build(Temple);

    expect(
      treasury
        .cost(cityBuild.city())
        .map((spendCost: SpendCost): number => spendCost.value())
    ).to.deep.equal([84]);

    treasury.buy(cityBuild.city());

    expect(treasury.value()).to.equal(16);
  });

  it('would be bought by a `Spend` rule without it', async (): Promise<void> => {
    const { cityBuild, ruleRegistry, treasury } = await setUp();

    priced(ruleRegistry);

    treasury.set(100);
    cityBuild.build(Capitalization);
    cityBuild.add(new BuildProgress(3));

    expect(treasury.cost(cityBuild.city()).length).to.equal(1);
  });
});
