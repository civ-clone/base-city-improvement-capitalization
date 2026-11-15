import { PlayerTreasuryRegistry } from '@civ-clone/core-treasury/PlayerTreasuryRegistry';
import BuildCost from '@civ-clone/core-city-build/Rules/BuildCost';
import BuildingHeld from '@civ-clone/core-city-build/Rules/BuildingHeld';
import Capitalization from '../Capitalization';
import City from '@civ-clone/core-city/City';
import CityBuild from '@civ-clone/core-city-build/CityBuild';
import Criterion from '@civ-clone/core-rule/Criterion';
import Hold from '@civ-clone/core-city-build/Rules/Hold';
import Yield from '@civ-clone/core-yield/Yield';
export interface CapitalizationDependencies {
  playerTreasuryRegistry?: PlayerTreasuryRegistry;
}
export interface CapitalizationOptions {
  /** The item: `Capitalization`, or a ruleset's subclass of it. `Capitalization` by default. */
  Item?: typeof Capitalization;
  /**
   * The start of the rules' ids: `<idPrefix>:city/build-cost/capitalization`, `…:city/hold/capitalization` and
   *  `…:city/building-held/capitalization`. `base-city-improvement-capitalization` by default. The `Hold` rule's id is
   *  what a client is given for why the build waits.
   */
  idPrefix?: string;
}
export interface CapitalizationConversionOptions extends CapitalizationOptions {
  /** The treasury the gold goes into: the player's treasury of this yield. */
  YieldType: typeof Yield;
  /**
   * Whether the city's production is paid out this turn. When it isn't, the build's progress is lost all the same:
   *  the turn's production, and on the first turn whatever the city had when it changed to it. Always, by default;
   *  the original pays nothing under Anarchy.
   */
  pays?: (city: City) => boolean;
}
/** Whether `item` is `Item` (`Capitalization` by default) or a subclass of it. */
export declare const isCapitalization: (
  item: unknown,
  Item?: typeof Capitalization
) => boolean;
/** Whether `cityBuild` is building `Item` (`Capitalization` by default). */
export declare const isBuildingCapitalization: (
  cityBuild: CityBuild,
  Item?: typeof Capitalization
) => boolean;
/** Its cost: nothing, so it is paid for at every check, with whatever progress is there. */
export declare const capitalizationCost: (
  options?: CapitalizationOptions
) => BuildCost[];
/** A `Hold` rule that always holds it, so it never completes. It reads only the item, as `Hold` criteria must. */
export declare const capitalizationHold: (
  options?: CapitalizationOptions
) => Hold[];
/**
 * Pays `amount` of production into the city's player's `YieldType` treasury, one for one, when it is above 0 and
 *  `pays` allows it, and gives what was paid. The conversion rule calls it.
 *
 * A ruleset can instead call it from its own production step with the turn's production, and not add that production
 *  to the build. The city's stored production is then kept only if the ruleset registers the cost, the `Hold` rule and
 *  the queue rule and leaves out `capitalizationConversion`: `capitalizationRules` includes the conversion, which pays
 *  the stored progress out on the first turn.
 */
export declare const payOut: (
  city: City,
  amount: number,
  { playerTreasuryRegistry }: CapitalizationDependencies,
  { YieldType, pays }: CapitalizationConversionOptions
) => number;
/**
 * A `BuildingHeld` rule that turns the build's progress into `YieldType` (gold), one for one, into the city's player's
 *  treasury, and sets the progress back to 0. `CityBuild#check` processes it every turn, after the turn's production
 *  (net of what the city's units cost) has gone in, so each turn pays out that turn's production. The first turn also
 *  pays out whatever progress the city had when it changed to it.
 */
export declare const capitalizationConversion: (
  dependencies: CapitalizationDependencies | undefined,
  options: CapitalizationConversionOptions
) => BuildingHeld[];
/**
 * A `BuildingHeld` rule that moves the city on from `Item` to the first item queued after it, once something is queued:
 *  as the `Hold` rule never lets it complete, the queue would otherwise never be reached. So building it means "until
 *  something else is queued". Queued items the city can no longer build are dropped first, without a notice. The
 *  change is a choice like any other (`CityBuild#choose`), so the ruleset's `ProductionChanged` rules are asked.
 *
 * `Low`, so it runs after the conversion has paid out the turn's production: the next item starts from what is left.
 */
export declare const capitalizationQueue: (
  options?: CapitalizationOptions
) => BuildingHeld[];
/**
 * A criterion for a ruleset's own `Spend` rules (the price of buying what a city builds): not while the city builds
 *  `Item`. A `Spend` rule can't refuse another's price, so each one that could answer for it takes this.
 *
 * With no cost, nothing is left to buy, so base-treasury's `isBuying` is already false for it; this is for a `Spend`
 *  rule that doesn't ask that.
 */
export declare const notBuyingCapitalization: (
  Item?: typeof Capitalization
) => Criterion;
/** All four: its cost, the `Hold` rule, the conversion and the move on to the queue. */
export declare const capitalizationRules: (
  dependencies: CapitalizationDependencies,
  options: CapitalizationConversionOptions
) => (BuildCost | Hold | BuildingHeld)[];
export default capitalizationRules;
