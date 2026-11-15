"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Capitalization = void 0;
const CityImprovement_1 = require("@civ-clone/core-city-improvement/CityImprovement");
/**
 * Something a city can build that never completes: while the city builds it, each turn's production is turned into
 *  gold instead (the idea is often called "coinage"). It has no cost, can't be bought, and is never added to the
 *  city's improvements. `lib/capitalizationRules` has the rules that make it so.
 */
class Capitalization extends CityImprovement_1.default {
}
exports.Capitalization = Capitalization;
exports.default = Capitalization;
//# sourceMappingURL=Capitalization.js.map