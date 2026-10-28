# Changelog

## [1.4.11](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.10...open-pedigree-v1.4.11) (2026-10-28)


### Bug Fixes

* code each parent in the GA4GH export as mother, father or parent by their own gender ([#65](https://github.com/aehrc/open-pedigree/issues/65)) ([12b6a34](https://github.com/aehrc/open-pedigree/commit/12b6a3413bf28a2f617aded37d85cbca7ce7b978))

## [1.4.10](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.9...open-pedigree-v1.4.10) (2026-10-27)


### Bug Fixes

* keep legacy pedigrees' term names and codes when they're re-saved ([#62](https://github.com/aehrc/open-pedigree/issues/62)) ([17bf756](https://github.com/aehrc/open-pedigree/commit/17bf7566d6dde9d36a841e4f8a4fa181c7b6de20))

## [1.4.9](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.8...open-pedigree-v1.4.9) (2026-10-27)


### Bug Fixes

* keep legend codings through reloads, and look up HPO codes by their real ID ([#60](https://github.com/aehrc/open-pedigree/issues/60)) ([5f6ae6c](https://github.com/aehrc/open-pedigree/commit/5f6ae6c127c038f1bf1b1efdc193a0aa3a9eb2c9))

## [1.4.8](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.7...open-pedigree-v1.4.8) (2026-10-27)


### Bug Fixes

* export looked-up legend terms with their coding, not as bare text ([#58](https://github.com/aehrc/open-pedigree/issues/58)) ([078a934](https://github.com/aehrc/open-pedigree/commit/078a93465aa45f1129ff7521e113119e8d738c5d))

## [1.4.7](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.6...open-pedigree-v1.4.7) (2026-10-27)


### Bug Fixes

* count each person once in the legends after their properties are reassigned ([#56](https://github.com/aehrc/open-pedigree/issues/56)) ([2a38e2a](https://github.com/aehrc/open-pedigree/commit/2a38e2a91a9ab69435cb9acf87e0eb9bac026aa0))

## [1.4.6](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.5...open-pedigree-v1.4.6) (2026-09-30)


### Bug Fixes

* make every kind of linked-record field read-only, not just text, number and checkbox ([#47](https://github.com/aehrc/open-pedigree/issues/47)) ([25c311c](https://github.com/aehrc/open-pedigree/commit/25c311cc273f496d66f493b1c2f1470fab6d7a0e))

## [1.4.5](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.4...open-pedigree-v1.4.5) (2026-09-29)


### Bug Fixes

* open pedigrees saved in the Legacy FHIR format again, and save that format as GA4GH ([#45](https://github.com/aehrc/open-pedigree/issues/45)) ([fa725b8](https://github.com/aehrc/open-pedigree/commit/fa725b8d8606dbff2666a720836bbc00fab3d15c))

## [1.4.4](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.3...open-pedigree-v1.4.4) (2026-09-29)


### Bug Fixes

* make SVG export work again, so saved pedigrees carry their image ([#43](https://github.com/aehrc/open-pedigree/issues/43)) ([0882ddc](https://github.com/aehrc/open-pedigree/commit/0882ddc7e1e308329ac8c2f367c336bfa828ab1e))

## [1.4.3](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.2...open-pedigree-v1.4.3) (2026-09-29)


### Bug Fixes

* keep calendar dates on their own day in every time zone ([#41](https://github.com/aehrc/open-pedigree/issues/41)) ([94021d2](https://github.com/aehrc/open-pedigree/commit/94021d2614b03bd909d1c79da960d422060d0716))

## [1.4.2](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.1...open-pedigree-v1.4.2) (2026-09-29)


### Bug Fixes

* keep a GA4GH pedigree loadable, with its answers, after it's saved again ([#39](https://github.com/aehrc/open-pedigree/issues/39)) ([0607796](https://github.com/aehrc/open-pedigree/commit/0607796738efd04e706d75c7a1ece158e47dddcb))

## [1.4.1](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.0...open-pedigree-v1.4.1) (2026-09-28)


### Bug Fixes

* don't show a node-menu tab that has nothing left on it ([#37](https://github.com/aehrc/open-pedigree/issues/37)) ([9a2a568](https://github.com/aehrc/open-pedigree/commit/9a2a568156ba256474b059a0f70390d42f470b3c))

## [1.4.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.3.0...open-pedigree-v1.4.0) (2026-09-28)


### Features

* let a record-link provider bring the record's answers when linking ([#34](https://github.com/aehrc/open-pedigree/issues/34)) ([e0e0ad5](https://github.com/aehrc/open-pedigree/commit/e0e0ad5a68764f89ea12747d003c40c4c7d6d785))

## [1.3.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.2.0...open-pedigree-v1.3.0) (2026-09-24)


### Features

* keep linked records through GA4GH saves, and make refreshes apply the record's changes ([#30](https://github.com/aehrc/open-pedigree/issues/30)) ([7625004](https://github.com/aehrc/open-pedigree/commit/7625004b4c6524b5955cb5b6bd89bfe99e38bd91))

## [1.2.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.1.0...open-pedigree-v1.2.0) (2026-09-24)


### Features

* let a record-link provider relabel its node-menu actions ([#27](https://github.com/aehrc/open-pedigree/issues/27)) ([208670f](https://github.com/aehrc/open-pedigree/commit/208670fe41e593cbe93093a4f1cc020290010130))

## [1.1.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.0.1...open-pedigree-v1.1.0) (2026-09-22)


### Features

* add AbstractRecordLinkProvider and Linked Record tab ([#26](https://github.com/aehrc/open-pedigree/issues/26)) ([610ee73](https://github.com/aehrc/open-pedigree/commit/610ee7341abf79b2318b4d4d072ad4540259ec75))


### Bug Fixes

* resolve remaining npm audit findings (9 -&gt; 0) ([#22](https://github.com/aehrc/open-pedigree/issues/22)) ([96b3c83](https://github.com/aehrc/open-pedigree/commit/96b3c83fa6ea03aedc2855e0b2c77cba6941d23b))

## [1.0.1](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.0.0...open-pedigree-v1.0.1) (2026-09-21)


### Bug Fixes

* guard remaining unguarded noUndoRedo check against null event.detail ([55d3168](https://github.com/aehrc/open-pedigree/commit/55d3168baa58fe8c5da6d4636922d71cb719c483))
