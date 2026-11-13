# Changelog

## [2.1.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v2.0.0...open-pedigree-v2.1.0) (2026-11-13)


### Features

* a result for each gene, drawn under the symbol and saved with standard codes ([#102](https://github.com/aehrc/open-pedigree/issues/102)) ([6c8bf6c](https://github.com/aehrc/open-pedigree/commit/6c8bf6c268855981c546d657dd846508f1e9a446))

## [2.0.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.8.0...open-pedigree-v2.0.0) (2026-11-13)


### ⚠ BREAKING CHANGES

* publish open-pedigree's FHIR definitions at resolvable URLs ([#100](https://github.com/aehrc/open-pedigree/issues/100))

### Features

* publish open-pedigree's FHIR definitions at resolvable URLs ([#100](https://github.com/aehrc/open-pedigree/issues/100)) ([fb46ceb](https://github.com/aehrc/open-pedigree/commit/fb46ceb47fcc84ee83751877f0a307b6ce39ea76))

## [1.8.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.7.0...open-pedigree-v1.8.0) (2026-11-12)


### Features

* a host can supply the transport for the local editor's save and load ([#99](https://github.com/aehrc/open-pedigree/issues/99)) ([7202ab0](https://github.com/aehrc/open-pedigree/commit/7202ab0561b56c864a51aef8a647a1b7ca64f35a))


### Bug Fixes

* resolve CodeQL incomplete-sanitization alerts ([#97](https://github.com/aehrc/open-pedigree/issues/97)) ([02e6625](https://github.com/aehrc/open-pedigree/commit/02e6625d00a30406eb6687869faf2bc0a602efc9))
* the GA4GH export honours its privacy options ([#96](https://github.com/aehrc/open-pedigree/issues/96)) ([2b1346b](https://github.com/aehrc/open-pedigree/commit/2b1346b5f2171c1590a744cd00179ab598775a40))

## [1.7.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.6.0...open-pedigree-v1.7.0) (2026-11-11)


### Features

* generation numbering, and a de-identified export with age bands ([#94](https://github.com/aehrc/open-pedigree/issues/94)) ([866cc02](https://github.com/aehrc/open-pedigree/commit/866cc02ad020fad27bfd81d9b3f0eabd13bcb8e6))

## [1.6.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.5...open-pedigree-v1.6.0) (2026-11-11)


### Features

* a partner can be added without a child ([#93](https://github.com/aehrc/open-pedigree/issues/93)) ([d49a07a](https://github.com/aehrc/open-pedigree/commit/d49a07a9c929e645ef40b16872bcd19d071d414f))


### Bug Fixes

* keep a person adopted when their parents aren't in the pedigree ([#90](https://github.com/aehrc/open-pedigree/issues/90)) ([50f81f7](https://github.com/aehrc/open-pedigree/commit/50f81f7bce365c9a3dcccfd64d0aa71039e126af))
* read a gene saved without QuestionnaireResponses as a gene, not a phenotype ([#91](https://github.com/aehrc/open-pedigree/issues/91)) ([d1a63fa](https://github.com/aehrc/open-pedigree/commit/d1a63fac4708961ce5ad3f3abaf43371ac04da8a))
* report import validation failures correctly, and keep an unborn carrier's mark clear of the "P" ([#89](https://github.com/aehrc/open-pedigree/issues/89)) ([0929e18](https://github.com/aehrc/open-pedigree/commit/0929e18c12d1210dc860c30c0bfafc0be82bcf35))

## [1.5.5](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.4...open-pedigree-v1.5.5) (2026-11-05)


### Bug Fixes

* follow-ups from the review of 1.5.4 - fetus parents, needed references, dependent defaults, typing ([#87](https://github.com/aehrc/open-pedigree/issues/87)) ([a2ce89c](https://github.com/aehrc/open-pedigree/commit/a2ce89cb7781ceda1bed5e5cc749e927105f9408))

## [1.5.4](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.3...open-pedigree-v1.5.4) (2026-11-04)


### Bug Fixes

* a choice's marked default is a new person's answer, and a drop-down shows only the real answer ([#84](https://github.com/aehrc/open-pedigree/issues/84)) ([951b850](https://github.com/aehrc/open-pedigree/commit/951b850eb5a5ce42a7c8f211a57c30da8e7fdaa2))
* keep a fetus's status and date of death, and an adoption, when a pedigree is opened again ([#85](https://github.com/aehrc/open-pedigree/issues/85)) ([634d2bb](https://github.com/aehrc/open-pedigree/commit/634d2bbf1917f4a937dc4f2f087a8fa368470d2a))
* typing in any text or number field is one undo step, and pasted text is saved ([#83](https://github.com/aehrc/open-pedigree/issues/83)) ([f821788](https://github.com/aehrc/open-pedigree/commit/f821788112bfa01c81e31ebe77f690aca4df2535))

## [1.5.3](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.2...open-pedigree-v1.5.3) (2026-11-03)


### Bug Fixes

* a radio choice can be reset to unanswered ([#80](https://github.com/aehrc/open-pedigree/issues/80)) ([e8a2e2e](https://github.com/aehrc/open-pedigree/commit/e8a2e2ed85f40542407b6cf3efba12bb13bb6416))
* load a stored pedigree only once its questionnaireUrl has arrived ([#81](https://github.com/aehrc/open-pedigree/issues/81)) ([1fee692](https://github.com/aehrc/open-pedigree/commit/1fee6924b6329a853878ef0d8dec9f17104e8deb))

## [1.5.2](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.1...open-pedigree-v1.5.2) (2026-11-02)


### Bug Fixes

* redo a change again, and combine typing in a text field into one undo step ([#78](https://github.com/aehrc/open-pedigree/issues/78)) ([12432c8](https://github.com/aehrc/open-pedigree/commit/12432c812409d6bd6dbb4c1f2964266fb105c42c))

## [1.5.1](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.5.0...open-pedigree-v1.5.1) (2026-11-01)


### Bug Fixes

* keep a term's codes when the terminology changes between saves ([#75](https://github.com/aehrc/open-pedigree/issues/75)) ([11e2667](https://github.com/aehrc/open-pedigree/commit/11e26676952a45c5016792407bcac833470479c0))

## [1.5.0](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.14...open-pedigree-v1.5.0) (2026-10-29)


### Features

* tell the user when linked records changed since the pedigree was saved ([#73](https://github.com/aehrc/open-pedigree/issues/73)) ([4c7fef2](https://github.com/aehrc/open-pedigree/commit/4c7fef22e376053e35790a5e49e841b8f1c3db4f))

## [1.4.14](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.13...open-pedigree-v1.4.14) (2026-10-29)


### Bug Fixes

* an unanswered drop-down shows '-', not its first option ([#71](https://github.com/aehrc/open-pedigree/issues/71)) ([36f308a](https://github.com/aehrc/open-pedigree/commit/36f308a19adb923d097e84490ec772e9618a0a31))

## [1.4.13](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.12...open-pedigree-v1.4.13) (2026-10-29)


### Bug Fixes

* show each person's own answers on the node form, checkboxes for repeating choices, and readable read-only fields ([#69](https://github.com/aehrc/open-pedigree/issues/69)) ([8bd8404](https://github.com/aehrc/open-pedigree/commit/8bd8404b814a881d68dfac9d931e9b8f3a90b712))

## [1.4.12](https://github.com/aehrc/open-pedigree/compare/open-pedigree-v1.4.11...open-pedigree-v1.4.12) (2026-10-28)


### Bug Fixes

* read back same-sex parents, and don't export the deceased as unborn ([#67](https://github.com/aehrc/open-pedigree/issues/67)) ([534e105](https://github.com/aehrc/open-pedigree/commit/534e105d14ec815846cb975e5fa29e67bcda1f68))

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
