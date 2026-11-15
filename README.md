# base-city-improvement-capitalization

Capitalization: something a city can build that never completes. While a city builds it, each turn's production is
turned into gold instead, one for one. The idea is often called "coinage". It has no cost, can't be bought, and is never
added to the city's improvements.

A library: it has no `main` and registers no rules. A ruleset registers the class as something cities can build, with
its own requirements (an advance, say), and the rules below.

## API

- `Capitalization`: the item, a `CityImprovement`. A ruleset may subclass it and pass its subclass as `Item`.
- `lib/capitalizationRules`:
  - `capitalizationRules(dependencies, options)`: all three of the rules below.
  - `capitalizationCost(options?)`: a `BuildCost` rule. It costs nothing, so it is paid for at every check, with
    whatever progress is there.
  - `capitalizationHold(options?)`: a `Hold` rule that always holds it, so it never completes. It reads only the
    item, as `Hold` criteria must, so `CityBuild#heldFor` gives its id beside it in a build menu.
  - `capitalizationConversion(dependencies, options)`: a `BuildingHeld` rule. It turns the build's progress into
    `YieldType` in the city's player's treasury, one for one, and sets the progress back to 0.
  - `notBuyingCapitalization(Item?)`: a criterion for a ruleset's own `Spend` rules, so they don't price it.
  - `isCapitalization(item, Item?)` and `isBuildingCapitalization(cityBuild, Item?)`. A ruleset that tells a player
    each turn a build is held can use these to leave this one out.

`dependencies` are `{ playerTreasuryRegistry? }`. `options`:

- `YieldType` (for the conversion): the treasury the gold goes into.
- `pays(city)`: whether the city's production is paid out this turn. When it isn't, the production is lost all the
  same. Always, by default.
- `Item`: `Capitalization` by default.
- `idPrefix`: the start of the rules' ids, `<idPrefix>:city/build-cost/capitalization`, `…:city/hold/capitalization`
  and `…:city/building-held/capitalization`. `base-city-improvement-capitalization` by default. The `Hold` rule's id
  is what a client is given for why the build waits.

## How it works

core-city-build needs no seam for this. `CityBuild#check` runs once a turn, after the turn's production has gone in.
The production is net of what the city's units cost, and no production goes in during civil disorder (base-city-
lifecycle's `buildWithProduction`). The build costs nothing, so it is always paid for. The `Hold` rule holds it, so
`check` processes the `BuildingHeld` rules instead of completing it, and the conversion pays the progress out.

The first turn also pays out whatever progress the city had when it changed to Capitalization, after any loss the
ruleset's `ProductionChanged` rules take for the change.

## Buying it

A `Spend` rule can't refuse another rule's price, so the ruleset keeps its own `Spend` rules from pricing it. With no
cost, nothing is left to buy: `remaining()` is 0 or less, so base-treasury's `isBuying` is already false for it. A
`Spend` rule that doesn't ask `isBuying` takes `notBuyingCapitalization()`.

## Following OpenCiv2

OpenCiv2 (github.com/richardpenman/civ2, `src/auto/city.cpp`, `city_production.cpp`) does the following:

- `city_split_trade`: while a city builds Capitalization, `total_shields - shield_support`, when above 0, is added to
  the city's tax after the Marketplace and Bank bonuses, so one for one.
- `city_process_disorder`: the tax only reaches the treasury outside civil disorder and Anarchy (`pays`).
- `city_process_production`: it never completes (`improvement != IMP_CAPITALIZATION`).
- `city_button_buy`: it can't be bought.

One difference: `city_process_production` doesn't add the turn's shields to the box while the city builds
Capitalization (`if (building != -IMP_CAPITALIZATION) shield_box += net_shields`). The box keeps whatever it had, and
a later change back to something else finds it there. Here the progress the city had is paid out as gold on the first
turn.
