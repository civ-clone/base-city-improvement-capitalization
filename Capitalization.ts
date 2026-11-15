import CityImprovement from '@civ-clone/core-city-improvement/CityImprovement';

/**
 * Something a city can build that never completes: while the city builds it, each turn's production is turned into
 *  gold instead (the idea is often called "coinage"). It has no cost, can't be bought, and is never added to the
 *  city's improvements. `lib/capitalizationRules` has the rules that make it so.
 */
export class Capitalization extends CityImprovement {}

export default Capitalization;
