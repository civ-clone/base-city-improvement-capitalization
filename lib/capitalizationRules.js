"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalizationRules = exports.notBuyingCapitalization = exports.capitalizationQueue = exports.capitalizationConversion = exports.payOut = exports.capitalizationHold = exports.capitalizationCost = exports.isBuildingCapitalization = exports.isCapitalization = void 0;
const PlayerTreasuryRegistry_1 = require("@civ-clone/core-treasury/PlayerTreasuryRegistry");
const BuildCost_1 = require("@civ-clone/core-city-build/Rules/BuildCost");
const BuildCost_2 = require("@civ-clone/core-city-build/BuildCost");
const BuildingHeld_1 = require("@civ-clone/core-city-build/Rules/BuildingHeld");
const Capitalization_1 = require("../Capitalization");
const Criterion_1 = require("@civ-clone/core-rule/Criterion");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const Hold_1 = require("@civ-clone/core-city-build/Rules/Hold");
const Low_1 = require("@civ-clone/core-rule/Priorities/Low");
const prefixOf = (options) => { var _a; return (_a = options.idPrefix) !== null && _a !== void 0 ? _a : 'base-city-improvement-capitalization'; };
/** Whether `item` is `Item` (`Capitalization` by default) or a subclass of it. */
const isCapitalization = (item, Item = Capitalization_1.default) => item === Item ||
    (typeof item === 'function' && Object.isPrototypeOf.call(Item, item));
exports.isCapitalization = isCapitalization;
/** Whether `cityBuild` is building `Item` (`Capitalization` by default). */
const isBuildingCapitalization = (cityBuild, Item = Capitalization_1.default) => { var _a; return (0, exports.isCapitalization)((_a = cityBuild.building()) === null || _a === void 0 ? void 0 : _a.item(), Item); };
exports.isBuildingCapitalization = isBuildingCapitalization;
/** Its cost: nothing, so it is paid for at every check, with whatever progress is there. */
const capitalizationCost = (options = {}) => {
    var _a;
    const Item = (_a = options.Item) !== null && _a !== void 0 ? _a : Capitalization_1.default;
    return [
        new BuildCost_1.default(`${prefixOf(options)}:city/build-cost/capitalization`, new Criterion_1.default((buildItem) => (0, exports.isCapitalization)(buildItem.item(), Item)), new Effect_1.default(() => new BuildCost_2.default(0))),
    ];
};
exports.capitalizationCost = capitalizationCost;
/** A `Hold` rule that always holds it, so it never completes. It reads only the item, as `Hold` criteria must. */
const capitalizationHold = (options = {}) => {
    var _a;
    const Item = (_a = options.Item) !== null && _a !== void 0 ? _a : Capitalization_1.default;
    return [
        new Hold_1.default(`${prefixOf(options)}:city/hold/capitalization`, new Criterion_1.default((cityBuild, item) => (0, exports.isCapitalization)(item, Item))),
    ];
};
exports.capitalizationHold = capitalizationHold;
/**
 * Pays `amount` of production into the city's player's `YieldType` treasury, one for one, when it is above 0 and
 *  `pays` allows it, and gives what was paid. The conversion rule calls it.
 *
 * A ruleset can instead call it from its own production step with the turn's production, and not add that production
 *  to the build. The city's stored production is then kept only if the ruleset registers the cost, the `Hold` rule and
 *  the queue rule and leaves out `capitalizationConversion`: `capitalizationRules` includes the conversion, which pays
 *  the stored progress out on the first turn.
 */
const payOut = (city, amount, { playerTreasuryRegistry = PlayerTreasuryRegistry_1.instance, }, { YieldType, pays = () => true }) => {
    if (amount <= 0 || !pays(city)) {
        return 0;
    }
    playerTreasuryRegistry
        .getByPlayerAndType(city.player(), YieldType)
        .add(amount);
    return amount;
};
exports.payOut = payOut;
/**
 * A `BuildingHeld` rule that turns the build's progress into `YieldType` (gold), one for one, into the city's player's
 *  treasury, and sets the progress back to 0. `CityBuild#check` processes it every turn, after the turn's production
 *  (net of what the city's units cost) has gone in, so each turn pays out that turn's production. The first turn also
 *  pays out whatever progress the city had when it changed to it.
 */
const capitalizationConversion = (dependencies = {}, options) => {
    var _a;
    const Item = (_a = options.Item) !== null && _a !== void 0 ? _a : Capitalization_1.default;
    return [
        new BuildingHeld_1.default(`${prefixOf(options)}:city/building-held/capitalization`, new Criterion_1.default((cityBuild, item) => (0, exports.isCapitalization)(item, Item)), new Effect_1.default((cityBuild) => {
            const value = cityBuild.progress().value();
            cityBuild.progress().set(0, 'capitalization');
            (0, exports.payOut)(cityBuild.city(), value, dependencies, options);
        })),
    ];
};
exports.capitalizationConversion = capitalizationConversion;
/**
 * A `BuildingHeld` rule that moves the city on from `Item` to the first item queued after it, once something is queued:
 *  as the `Hold` rule never lets it complete, the queue would otherwise never be reached. So building it means "until
 *  something else is queued". Queued items the city can no longer build are dropped first, without a notice. The
 *  change is a choice like any other (`CityBuild#choose`), so the ruleset's `ProductionChanged` rules are asked.
 *
 * `Low`, so it runs after the conversion has paid out the turn's production: the next item starts from what is left.
 */
const capitalizationQueue = (options = {}) => {
    var _a;
    const Item = (_a = options.Item) !== null && _a !== void 0 ? _a : Capitalization_1.default;
    return [
        new BuildingHeld_1.default(`${prefixOf(options)}:city/building-held/capitalization-queue`, new Low_1.default(), new Criterion_1.default((cityBuild, item) => (0, exports.isCapitalization)(item, Item)), new Criterion_1.default((cityBuild) => cityBuild.queued().length > 0), new Effect_1.default((cityBuild) => {
            while (cityBuild.queued().length > 0) {
                const [next] = cityBuild.queued();
                if (cityBuild.getAvailable(next)) {
                    cityBuild.choose(next);
                    return;
                }
                cityBuild.dequeue(0);
            }
        })),
    ];
};
exports.capitalizationQueue = capitalizationQueue;
/**
 * A criterion for a ruleset's own `Spend` rules (the price of buying what a city builds): not while the city builds
 *  `Item`. A `Spend` rule can't refuse another's price, so each one that could answer for it takes this.
 *
 * With no cost, nothing is left to buy, so base-treasury's `isBuying` is already false for it; this is for a `Spend`
 *  rule that doesn't ask that.
 */
const notBuyingCapitalization = (Item = Capitalization_1.default) => new Criterion_1.default((cityBuild) => !(0, exports.isBuildingCapitalization)(cityBuild, Item));
exports.notBuyingCapitalization = notBuyingCapitalization;
/** All four: its cost, the `Hold` rule, the conversion and the move on to the queue. */
const capitalizationRules = (dependencies, options) => [
    ...(0, exports.capitalizationCost)(options),
    ...(0, exports.capitalizationHold)(options),
    ...(0, exports.capitalizationConversion)(dependencies, options),
    ...(0, exports.capitalizationQueue)(options),
];
exports.capitalizationRules = capitalizationRules;
exports.default = exports.capitalizationRules;
//# sourceMappingURL=capitalizationRules.js.map