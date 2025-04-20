# Changelog

## [1.10.1](https://github.com/gravity-ui/onboarding/compare/v1.10.0...v1.10.1) (2025-04-18)


### Bug Fixes

* export useOnboardingStepBySelector hook ([d48b846](https://github.com/gravity-ui/onboarding/commit/d48b8469aa00e7fe225a338a44a20b54d44d2388))

## [1.10.0](https://github.com/gravity-ui/onboarding/compare/v1.9.0...v1.10.0) (2025-04-18)


### Features

* add useOnboardingStepBySelector hook ([39b67df](https://github.com/gravity-ui/onboarding/commit/39b67df8d287526352f95fc5a36451e257a99a68))


### Bug Fixes

* type HTMLElement -&gt; Element ([529822a](https://github.com/gravity-ui/onboarding/commit/529822a14b42b93c43dd4cb3a55f7c2fe9447975))

## [1.9.0](https://github.com/gravity-ui/onboarding/compare/v1.8.1...v1.9.0) (2025-03-25)


### Features

* **onboarding:** add applyDefaultState hook ([5503bb5](https://github.com/gravity-ui/onboarding/commit/5503bb5daea05558f98ee953b444e7d1f2ba6ebb))
* **onboarding:** add global turn off switch ([12f37e6](https://github.com/gravity-ui/onboarding/commit/12f37e60744e9eb684e41ff7c3aa9916f376ba12))

## [1.8.1](https://github.com/gravity-ui/onboarding/compare/v1.8.0...v1.8.1) (2025-03-24)


### Bug Fixes

* **promo-manager:** promo-wrapper typings ([bcff16e](https://github.com/gravity-ui/onboarding/commit/bcff16e5eb45d3dbc6ae59752623417811705ef9))

## [1.8.0](https://github.com/gravity-ui/onboarding/compare/v1.7.0...v1.8.0) (2025-03-21)


### Features

* add PromoWrapper component ([d64e932](https://github.com/gravity-ui/onboarding/commit/d64e93225995c14652afcc6068d513ae02cdfa08))
* **onboarding:** add lastUserActivity state property ([99f5ed0](https://github.com/gravity-ui/onboarding/commit/99f5ed0057d66f23340c2a44cd534c603ab1b2f5))

## [1.7.0](https://github.com/gravity-ui/onboarding/compare/v1.6.1...v1.7.0) (2025-03-20)


### Features

* **onboarding:** add resetPresetProgress event ([244db09](https://github.com/gravity-ui/onboarding/commit/244db0966d71452aadd00000d73cf465fe78bc38))
* **onboarding:** reset preset progress -&gt; reset promo-manager promo progress ([2b4f220](https://github.com/gravity-ui/onboarding/commit/2b4f220bad29ae0ab8ae7b300f8c58994e0ff968))

## [1.6.1](https://github.com/gravity-ui/onboarding/compare/v1.6.0...v1.6.1) (2025-03-03)


### Bug Fixes

* **onboarding:** wrong step take for shared steps ([ff4796e](https://github.com/gravity-ui/onboarding/commit/ff4796e7a882acf74f7491ceaf993533906ecf1d))

## [1.6.0](https://github.com/gravity-ui/onboarding/compare/v1.5.0...v1.6.0) (2025-02-28)


### Features

* add close hint reason ([2f98d34](https://github.com/gravity-ui/onboarding/commit/2f98d34b1d1bc63adcd6aa6129925ba2fda64e6e))

## [1.5.0](https://github.com/gravity-ui/onboarding/compare/v1.4.1...v1.5.0) (2025-02-26)


### Features

* **onboarding:** add closeHintByUser event ([bdc97e4](https://github.com/gravity-ui/onboarding/commit/bdc97e458b982b3ea5419086c65333605e91513c))

## [1.4.1](https://github.com/gravity-ui/onboarding/compare/v1.4.0...v1.4.1) (2025-02-05)


### Bug Fixes

* **promo-manager:** invalidate base state after state sync ([ce7d113](https://github.com/gravity-ui/onboarding/commit/ce7d11312e9bfabd2e7049c2aeddb8a3843665f6))

## [1.4.0](https://github.com/gravity-ui/onboarding/compare/v1.3.0...v1.4.0) (2025-02-04)


### Features

* **onboarding:** allow synchronous progress state init ([e423daa](https://github.com/gravity-ui/onboarding/commit/e423daaeea93ab8c569a6d9f15476779780a2a57))


### Bug Fixes

* **onboarding:** dont call stepPass hook for passed steps ([6833f89](https://github.com/gravity-ui/onboarding/commit/6833f89e35307f6a0fdc66d3c4365b862d2a14ae))

## [1.3.0](https://github.com/gravity-ui/onboarding/compare/v1.2.1...v1.3.0) (2025-01-30)


### Features

* add enterDebugMode method ([2b1e7f2](https://github.com/gravity-ui/onboarding/commit/2b1e7f27ebc80a951b136b2a8b29c17cb10d8913))
* **promo-manager:** add cancel promo event ([b254184](https://github.com/gravity-ui/onboarding/commit/b254184fc80c544a3be77077198a5f4e24782621))
* **promo-manager:** add finish promo event ([bf17ff5](https://github.com/gravity-ui/onboarding/commit/bf17ff5c71dfd3415cbba0bfd3d38d718c5e2dfd))
* **promo-manager:** implement promoTabSync plugin ([cd00729](https://github.com/gravity-ui/onboarding/commit/cd007297bce30449a35b211a000007659bf977a1))

## [1.2.1](https://github.com/gravity-ui/onboarding/compare/v1.2.0...v1.2.1) (2025-01-20)


### Bug Fixes

* **onboarding:** for wizard plugin enable onboarding if wizard visible ([2b51139](https://github.com/gravity-ui/onboarding/commit/2b51139e13fd97bb51773a8a7fc5f8891dc9e229))

## [1.2.0](https://github.com/gravity-ui/onboarding/compare/v1.1.0...v1.2.0) (2025-01-15)


### Features

* **onboarding:** add customDefaultState option ([cfd3bf9](https://github.com/gravity-ui/onboarding/commit/cfd3bf9f390ed65d8f627aa5e21fc66c2f306171))
* **onboarding:** apply custom default for resetToDefaultState ([01110f0](https://github.com/gravity-ui/onboarding/commit/01110f0931053b3e44eed6b4bdeed9827013ea7e))

## [1.1.0](https://github.com/gravity-ui/onboarding/compare/v1.0.4...v1.1.0) (2025-01-14)


### Features

* **onboarding:** add ignoreUnknownPresets option ([038bc57](https://github.com/gravity-ui/onboarding/commit/038bc57aa508c0f0cbdc8d9576ce2fbb8730122f))
* **onboarding:** dont throw error for unknown presets ([955020d](https://github.com/gravity-ui/onboarding/commit/955020da54ab4c6c7a846b21848ee4a700d05408))
* type import ([67a4654](https://github.com/gravity-ui/onboarding/commit/67a4654405e62f9a17ee23e1b079975ee6ad27de))


### Bug Fixes

* **promo-manager:** fix period with short month ([844af6e](https://github.com/gravity-ui/onboarding/commit/844af6e60553cfb12d22d359f8dc4c3c33853bed))

## [1.0.4](https://github.com/gravity-ui/onboarding/compare/v1.0.3...v1.0.4) (2024-10-18)


### Bug Fixes

* **promo-manager, onboarding:** fix promo preset race condition ([66df0df](https://github.com/gravity-ui/onboarding/commit/66df0df2c060935422624ef82c4260c1370818c4))

## [1.0.3](https://github.com/gravity-ui/onboarding/compare/v1.0.2...v1.0.3) (2024-10-11)


### Bug Fixes

* **PM:** fix the timeout closure ([6ad7e8c](https://github.com/gravity-ui/onboarding/commit/6ad7e8c363e773369a7b9164d2f10317ec801d42))

## [1.0.2](https://github.com/gravity-ui/onboarding/compare/v1.0.1...v1.0.2) (2024-10-10)


### Bug Fixes

* **promo-managed:** allow to enable debug in config ([3b0f513](https://github.com/gravity-ui/onboarding/commit/3b0f513a62958e0f0ea1fff27ed9ba7ddb4f6e64))

## [1.0.1](https://github.com/gravity-ui/onboarding/compare/v1.0.0...v1.0.1) (2024-10-04)


### Bug Fixes

* **promo-manager:** get promo status for deleted promo ([78f251a](https://github.com/gravity-ui/onboarding/commit/78f251a51ad21d1fb7432dcbb03ad8c035d6a2d5))

## [1.0.0](https://github.com/gravity-ui/onboarding/compare/v0.24.2...v1.0.0) (2024-10-03)


### chore

* major release ([8f3002e](https://github.com/gravity-ui/onboarding/commit/8f3002efe4e20ee76649c605995e9a609ad578c4))

## [0.24.2](https://github.com/gravity-ui/onboarding/compare/v0.24.1...v0.24.2) (2024-10-03)


### Bug Fixes

* **onboarding:** close hint on goPrevStep ([0d48a4b](https://github.com/gravity-ui/onboarding/commit/0d48a4b276d971234a2f8dcd96295ce2165e870e))

## [0.24.1](https://github.com/gravity-ui/onboarding/compare/v0.24.0...v0.24.1) (2024-10-02)


### Bug Fixes

* **onboarding:** fix goPrevStep hint show ([11e29f7](https://github.com/gravity-ui/onboarding/commit/11e29f70804a4da37a3b91dec2a65af7c487e3f6))

## [0.24.0](https://github.com/gravity-ui/onboarding/compare/v0.23.4...v0.24.0) (2024-10-02)


### Features

* **onboarding:** add goNextstep, goPrevStep helpers ([2cc9881](https://github.com/gravity-ui/onboarding/commit/2cc988171382abbe28653eec1324cba8049e43b7))
* **promo-manager:** add repeated promos ([50d28b2](https://github.com/gravity-ui/onboarding/commit/50d28b2e1b973aac93098abd7a5f45b962e119fd))

## [0.23.4](https://github.com/gravity-ui/onboarding/compare/v0.23.3...v0.23.4) (2024-09-30)


### Bug Fixes

* **onboarding:** dont clear suggested in resetPresetProgress ([48f0c79](https://github.com/gravity-ui/onboarding/commit/48f0c79360034c2d9f2b89494f65b428b6f357b4))

## [0.23.3](https://github.com/gravity-ui/onboarding/compare/v0.23.2...v0.23.3) (2024-09-21)


### Bug Fixes

* **onboarding:** fix debug messages ([8495ed9](https://github.com/gravity-ui/onboarding/commit/8495ed9283d691f28d5866a52b5b3375b42e9a57))

## [0.23.2](https://github.com/gravity-ui/onboarding/compare/v0.23.1...v0.23.2) (2024-09-12)


### Bug Fixes

* **onboarding:** wizard-plugin fix turn on behavior ([73b727e](https://github.com/gravity-ui/onboarding/commit/73b727e069a2fad729bad7f6870d387e9574b28e))
* **promo-manager:** onboarding hint cancelled -&gt; don't trigger promo ([43eb5dd](https://github.com/gravity-ui/onboarding/commit/43eb5dddbb9430893a9b3008917cd3d801564567))

## [0.23.1](https://github.com/gravity-ui/onboarding/compare/v0.23.0...v0.23.1) (2024-09-10)


### Bug Fixes

* **onboarding:** erase progress for deleted preset ([9497909](https://github.com/gravity-ui/onboarding/commit/9497909281203f65be4325f0adf9bda837458bbe))

## [0.23.0](https://github.com/gravity-ui/onboarding/compare/v0.22.1...v0.23.0) (2024-09-05)


### Features

* **promo-manager:** add slug param for ShowOnceForSession ([36b829f](https://github.com/gravity-ui/onboarding/commit/36b829f2aca522e5df49174f7c20e1beedc62b19))

## [0.22.1](https://github.com/gravity-ui/onboarding/compare/v0.22.0...v0.22.1) (2024-09-03)


### Bug Fixes

* **promo-manager:** add usePromo hook export ([9d2fd5f](https://github.com/gravity-ui/onboarding/commit/9d2fd5fab23dca251e963c7fdbc035d6dc0471ab))

## [0.22.0](https://github.com/gravity-ui/onboarding/compare/v0.21.1...v0.22.0) (2024-09-02)


### Features

* **promo-manager:** add debug messages ([47df9d3](https://github.com/gravity-ui/onboarding/commit/47df9d3c93ebcdade10c856e3467aef47c3b8dba))
* **promo-manager:** resetToDefaultState -&gt; erase onboarding promo preset progress ([d7c328e](https://github.com/gravity-ui/onboarding/commit/d7c328ed4bfce948c3c5c66841b6e92b1b79eb05))


### Bug Fixes

* add default logger options ([1c709f5](https://github.com/gravity-ui/onboarding/commit/1c709f5f73e35a6e6d37e490523bd2d90cca45db))
* **onboarding:** reset preset progress -&gt; remove from suggested ([47b2abf](https://github.com/gravity-ui/onboarding/commit/47b2abf9217aea0db4fccb1fc42e621878672700))
* **promo-manager:** improve onboarding integration ([22b0be2](https://github.com/gravity-ui/onboarding/commit/22b0be262e5b3ce3491971ba8f6679dab20f58c3))
* **promo-manager:** repeated requestStart -&gt; return true ([4058e2e](https://github.com/gravity-ui/onboarding/commit/4058e2e6cd0863fa52715dc03b5bdac14e3077ad))

## [0.21.1](https://github.com/gravity-ui/onboarding/compare/v0.21.0...v0.21.1) (2024-08-28)


### Bug Fixes

* **promo-manager:** not save progress on start promo ([0202e04](https://github.com/gravity-ui/onboarding/commit/0202e045d6cb301ade17a4e17bafb38c8dce3357))

## [0.21.0](https://github.com/gravity-ui/onboarding/compare/v0.20.0...v0.21.0) (2024-08-16)


### chore

* bump version to 0.21.0 ([0e7806e](https://github.com/gravity-ui/onboarding/commit/0e7806e25dbe580d67b397310b7288075f7f731c))

## [0.20.0](https://github.com/gravity-ui/onboarding/compare/v0.19.0...v0.20.0) (2024-08-07)


### Features

* **promo manager:** add matchUrl condition ([86f3579](https://github.com/gravity-ui/onboarding/commit/86f3579944e76c58d6280bafd0ea4516c7da9a61))
* **promo manager:** add ShowOnceForSession condition ([6e4ffcc](https://github.com/gravity-ui/onboarding/commit/6e4ffcc3c9cdc96d071d9b377ff777a3b59e1819))
* **promo manager:** hooks and plugin system ([969131a](https://github.com/gravity-ui/onboarding/commit/969131a39759313525c9b2b12abfad6391b149f1))
* **promo manager:** run promo on custom event ([786ec85](https://github.com/gravity-ui/onboarding/commit/786ec854e2730c0789137f709285372ac97102f0))
* **promo manager:** timeout in events ([b883399](https://github.com/gravity-ui/onboarding/commit/b883399da02cb1607ffb7f93dafc9a14dd5565c5))
* **promo manager:** url-change plugin ([92277be](https://github.com/gravity-ui/onboarding/commit/92277be0bc84e4be9b17d091943936af35e4500f))


### Bug Fixes

* **onboarding:** erase progress for finished preset ([73a9bd7](https://github.com/gravity-ui/onboarding/commit/73a9bd7c4b68d38dca7ad9c15ac8d33062b3afe7))
* **promo-manager:** fix condition function typing ([b15d8c2](https://github.com/gravity-ui/onboarding/commit/b15d8c230c1da004ab1a126b27793e645be1af40))

## [0.19.0](https://github.com/gravity-ui/onboarding/compare/v0.18.1...v0.19.0) (2024-07-24)


### Features

* **onboarding:** pass step to closeHint event ([51c81b9](https://github.com/gravity-ui/onboarding/commit/51c81b94119d09caffe21e57c9206d57a65ce205))
* **promo-manager:** onboarding integration ([f5255f4](https://github.com/gravity-ui/onboarding/commit/f5255f41e7ea4f66c6d330a4218020515e5c5c8c))
* **promo-manager:** return result from requestStart method ([d305111](https://github.com/gravity-ui/onboarding/commit/d30511159b40ee13f3d46121fb0d08f135bbca1f))

## [0.18.1](https://github.com/gravity-ui/onboarding/compare/v0.18.0...v0.18.1) (2024-07-17)


### chore

* bump version to 0.18.1 ([4e9f0e6](https://github.com/gravity-ui/onboarding/commit/4e9f0e60e3d934511f1dee3ac20fcc2c6b9f0ca0))

## [0.18.0](https://github.com/gravity-ui/onboarding/compare/v0.17.2...v0.18.0) (2024-07-16)


### Features

* **promo-manager:** add constraints ([17f8a42](https://github.com/gravity-ui/onboarding/commit/17f8a4210c3e050ceb0fc3dc55b55c9fabcc0e98))
* **promo-manager:** add LimitFrequency constraint ([1081edf](https://github.com/gravity-ui/onboarding/commit/1081edf084098cc84bc52c8c1048a3645f5d04b3))
* **promo-manager:** fix and improve periodic helpers ([a1b7398](https://github.com/gravity-ui/onboarding/commit/a1b7398f3bda30ac5d919149d2a359afc67bb6d7))
* **promo-manager:** support json format for conditions ([148124f](https://github.com/gravity-ui/onboarding/commit/148124f1401d36d77365dc76b3cb87cd693c6ba0))


### Bug Fixes

* fix logger ([5571e0e](https://github.com/gravity-ui/onboarding/commit/5571e0e37ef97d53f039483a17e4a66868db4f3f))

## [0.17.2](https://github.com/gravity-ui/onboarding/compare/v0.17.1...v0.17.2) (2024-07-12)


### Bug Fixes

* **onboarding:** handle localstorage quota exceeded error ([9fe9f19](https://github.com/gravity-ui/onboarding/commit/9fe9f19620dc35550d0245ff563539e36747927a))
* **onboarding:** wizard become visible -&gt; don't close common hint ([72399e1](https://github.com/gravity-ui/onboarding/commit/72399e1809890888b6362fd6435eef741974c5cc))

## [0.17.1](https://github.com/gravity-ui/onboarding/compare/v0.17.0...v0.17.1) (2024-07-02)


### Bug Fixes

* **onboarding:** run always hidden preset -&gt; not erase progress ([c449b8f](https://github.com/gravity-ui/onboarding/commit/c449b8fac988f5954ac027ee6cf0d59b3d668530))

## [0.17.0](https://github.com/gravity-ui/onboarding/compare/v0.16.2...v0.17.0) (2024-07-01)


### Features

* **onboarding:** add promo preset plugin ([a2745de](https://github.com/gravity-ui/onboarding/commit/a2745ded27d5d09be004831fb75ee7a6569547c9))
* **onboarding:** add wizard plugin ([0e384b8](https://github.com/gravity-ui/onboarding/commit/0e384b8bcc2e64113b47014fe707bcc3aa6697c3))
* **onboarding:** wizard preset improvements ([c15931c](https://github.com/gravity-ui/onboarding/commit/c15931c8762f4622c76dc8a43c868908fe8ae607))

## [0.16.2](https://github.com/gravity-ui/onboarding/compare/v0.16.1...v0.16.2) (2024-06-18)


### Bug Fixes

* usage of meta in hook ([b59b77a](https://github.com/gravity-ui/onboarding/commit/b59b77a07f6415a5bf876700dbab3afce2d5803e))

## [0.16.1](https://github.com/gravity-ui/onboarding/compare/v0.16.0...v0.16.1) (2024-06-18)


### Bug Fixes

* hook typing ([7738dec](https://github.com/gravity-ui/onboarding/commit/7738dec81dc6814df7a0643b9141af83a52f1562))

## [0.16.0](https://github.com/gravity-ui/onboarding/compare/v0.15.0...v0.16.0) (2024-06-18)


### Features

* cancel promo timeout ([1cf980b](https://github.com/gravity-ui/onboarding/commit/1cf980ba1fa1e50fcc2f4ca5e9cd5821d238122f))
* disable finish of promo without progress saving ([a531d77](https://github.com/gravity-ui/onboarding/commit/a531d77fb2b1b20269a231a5789b67132cb85b25))
* validate preset in active promo hook ([09ca675](https://github.com/gravity-ui/onboarding/commit/09ca675cef8e4c521602800e4a8fc276b6fc74ac))
* implement event system, plugins system, add tab sync plugin ([5da722a](https://github.com/gravity-ui/onboarding/commit/5da722a90c223aa6ae0ea8966186b9608e616817))

## [0.15.0](https://github.com/gravity-ui/onboarding/compare/v0.14.1...v0.15.0) (2024-03-07)


### Features

* add promo manager ([811558c](https://github.com/gravity-ui/onboarding/commit/811558cc414128597ba8532c8f755aa106b80ef0))

## [0.14.1](https://github.com/gravity-ui/onboarding/compare/v0.14.0...v0.14.1) (2024-03-04)


### Bug Fixes

* make closeHint method public ([4db22c5](https://github.com/gravity-ui/onboarding/commit/4db22c54969179bc77d73797066cd3022ba1709a))

## [0.14.0](https://github.com/gravity-ui/onboarding/compare/v0.13.1...v0.14.0) (2024-03-04)


### Features

* improve event hooks ([44042f0](https://github.com/gravity-ui/onboarding/commit/44042f01c521cc179d460272915322e2edc737f2))


### Bug Fixes

* dont close hint as user when run preset ([ddebb48](https://github.com/gravity-ui/onboarding/commit/ddebb48efd9a1f88a407e85cb9bfdcbfce5a1763))

## [0.13.1](https://github.com/gravity-ui/onboarding/compare/v0.13.0...v0.13.1) (2024-02-22)


### Bug Fixes

* pass step -&gt; close hint as user ([f1ca776](https://github.com/gravity-ui/onboarding/commit/f1ca7765c09baaa6d0d39f018e4d0f479d6f181a))

## [0.13.0](https://github.com/gravity-ui/onboarding/compare/v0.12.0...v0.13.0) (2024-02-21)


### Features

* add resetToDefaultState method ([22db0b0](https://github.com/gravity-ui/onboarding/commit/22db0b0604f04008cb74da0755e7b33c30c2af41))

## [0.12.0](https://github.com/gravity-ui/onboarding/compare/v0.11.0...v0.12.0) (2023-10-25)


### Features

* add close hint hooks ([4c6d71a](https://github.com/gravity-ui/onboarding/commit/4c6d71a5a36e7cd5ec9bd04afac9c80c8d3c3393))

## [0.11.0](https://github.com/gravity-ui/onboarding/compare/v0.10.1...v0.11.0) (2023-10-19)


### Features

* initialHidden and alwaysHidden presets ([8780e64](https://github.com/gravity-ui/onboarding/commit/8780e64fd515494b8e270e2f4d9d652206305f4b))

## [0.10.1](https://github.com/gravity-ui/onboarding/compare/v0.10.0...v0.10.1) (2023-10-18)


### Bug Fixes

* close hint in rerender + step logic ([e84b0ec](https://github.com/gravity-ui/onboarding/commit/e84b0ec28809eb49ad26228a059a916822910dc1))

## [0.10.0](https://github.com/gravity-ui/onboarding/compare/v0.9.2...v0.10.0) (2023-10-09)


### Features

* onBeforeStart hook + fix onStart hook ([f684121](https://github.com/gravity-ui/onboarding/commit/f6841211c996c4f94f8f6eb25133b259f6cd2194))

## [0.9.2](https://github.com/gravity-ui/onboarding/compare/v0.9.1...v0.9.2) (2023-10-05)


### Bug Fixes

* complete new state on each update ([7725cdd](https://github.com/gravity-ui/onboarding/commit/7725cdd3d497dd86a4a3faab7b642864c68ffadc))
* public ensureRunning method ([d08025a](https://github.com/gravity-ui/onboarding/commit/d08025aa1d1c5784c63ba0fedb98e08e44180a53))

## [0.9.1](https://github.com/gravity-ui/onboarding/compare/v0.9.0...v0.9.1) (2023-10-04)


### Bug Fixes

* not duplicate suggested presets ([cb33543](https://github.com/gravity-ui/onboarding/commit/cb3354373cf4d7984ec640bb97bbe1490b7ef5a9))

## [0.9.0](https://github.com/gravity-ui/onboarding/compare/v0.8.0...v0.9.0) (2023-10-03)


### Features

* add helper for wizard state ([4c20ac8](https://github.com/gravity-ui/onboarding/commit/4c20ac8863496b19fe794f9011fc3a40bb8793b5))
* add some logs ([3c0bbbb](https://github.com/gravity-ui/onboarding/commit/3c0bbbb99d49a326178ee8ab916a355df3e5d7bb))
* allow pass step on not active preset ([ac3a83a](https://github.com/gravity-ui/onboarding/commit/ac3a83a6108f1fe42afe814f9a2af6326f41b270))
* batch state updates ([2e0370c](https://github.com/gravity-ui/onboarding/commit/2e0370c635a6957f7614cf564c172316a0be4d29))
* pick active preset for shared step ([b485f75](https://github.com/gravity-ui/onboarding/commit/b485f75f111cd8d3582343d39d82f78073b73ba6))

## [0.8.0](https://github.com/gravity-ui/onboarding/compare/v0.7.0...v0.8.0) (2023-09-25)


### Features

* combined preset prototype ([06445eb](https://github.com/gravity-ui/onboarding/commit/06445ebaab1bae25eed4bbb2d31a56f069116280))

## [0.7.0](https://github.com/gravity-ui/onboarding/compare/v0.6.0...v0.7.0) (2023-09-13)


### Features

* add invisible wizard state ([c80ee06](https://github.com/gravity-ui/onboarding/commit/c80ee0668c760b51b50a797dd12a96a41948c603))

## [0.6.0](https://github.com/gravity-ui/onboarding/compare/v0.5.3...v0.6.0) (2023-08-22)


### Features

* add finish preset helper ([b26af97](https://github.com/gravity-ui/onboarding/commit/b26af97555ca0fe81ea09a1ba1761d1d579957a1))

## [0.5.3](https://github.com/gravity-ui/onboarding/compare/v0.5.2...v0.5.3) (2023-08-22)


### Bug Fixes

* return preset description ([dbe9b08](https://github.com/gravity-ui/onboarding/commit/dbe9b08db3914fcda0df9f68cc02fbb78805b378))

## [0.5.2](https://github.com/gravity-ui/onboarding/compare/v0.5.1...v0.5.2) (2023-08-21)


### Bug Fixes

* preset search by step + preset restart ([cd91af7](https://github.com/gravity-ui/onboarding/commit/cd91af70ac6703fbdf3aa63040d7063c889fcd40))

## [0.5.1](https://github.com/gravity-ui/onboarding/compare/v0.5.0...v0.5.1) (2023-08-17)


### Bug Fixes

* hide wizard by default ([7624669](https://github.com/gravity-ui/onboarding/commit/7624669c4f0c5150b2887e679fb58ea723078bb8))

## [0.5.0](https://github.com/gravity-ui/onboarding/compare/v0.4.1...v0.5.0) (2023-08-17)


### Features

* add available presets ([4eb2809](https://github.com/gravity-ui/onboarding/commit/4eb280909d1f162e40f16486f5ae992d33438788))
* add wizard state ([916b9c1](https://github.com/gravity-ui/onboarding/commit/916b9c180c833734d793e321e528fe6255a3d6bb))
* user preset list + preset refactor ([fd82078](https://github.com/gravity-ui/onboarding/commit/fd820781a3ef4da7da86b5a7a87226593637b09f))
* wizard visible -&gt; load progress ([233349e](https://github.com/gravity-ui/onboarding/commit/233349e6254f49f1a0086a7eee9009cc646d5cee))


### Bug Fixes

* element appears before preset add ([262d343](https://github.com/gravity-ui/onboarding/commit/262d34392f5040caabf067a9e3f80abdb13bf101))
* hook export ([9efe93d](https://github.com/gravity-ui/onboarding/commit/9efe93d63f42b381333a8813d40798d54f9d18c2))
* remove unused code ([796442b](https://github.com/gravity-ui/onboarding/commit/796442b33f4fd4c2a4651dd8d646cd0c58a761aa))
* remove unused field from defaultBaseState ([516688c](https://github.com/gravity-ui/onboarding/commit/516688c55e3afaccbbb0a8282c309171bd2a4955))

## [0.4.1](https://github.com/gravity-ui/onboarding/compare/v0.4.0...v0.4.1) (2023-08-04)


### Bug Fixes

* emit state change after load progress ([799336b](https://github.com/gravity-ui/onboarding/commit/799336bbe8c446c97f11435aaaf6e97d6501f97b))

## [0.4.0](https://github.com/gravity-ui/onboarding/compare/v0.3.1...v0.4.0) (2023-08-03)


### Features

* add step pass hook ([beae3e0](https://github.com/gravity-ui/onboarding/commit/beae3e06d4e246cdb9390cc80e74ff9e1085a356))

## [0.3.1](https://github.com/gravity-ui/onboarding/compare/v0.3.0...v0.3.1) (2023-08-02)


### Bug Fixes

* load progress only once ([21fec7e](https://github.com/gravity-ui/onboarding/commit/21fec7e8b49819460d87dfd92ea302e0feab5913))

## [0.3.0](https://github.com/gravity-ui/onboarding/compare/v0.2.1...v0.3.0) (2023-07-28)


### Features

* add useOnboardingPreset, add presetsNames to export ([bd44b7c](https://github.com/gravity-ui/onboarding/commit/bd44b7cbae7b509ed0c1d27f283066c83650c20d))

## [0.2.1](https://github.com/gravity-ui/onboarding/compare/v0.2.0...v0.2.1) (2023-07-24)


### Bug Fixes

* HintParams typings ([9fa53b9](https://github.com/gravity-ui/onboarding/commit/9fa53b9b87795beccaf01510fa53b29bb3bc3354))

## [0.2.0](https://github.com/gravity-ui/onboarding/compare/v0.1.0...v0.2.0) (2023-07-24)


### Features

* better type inference ([97e2d44](https://github.com/gravity-ui/onboarding/commit/97e2d44cb7e071d41ff533f34237b5dcc16ded3d))

## 0.1.0 (2023-07-21)


### chore

* bump version to 0.1.0 ([38af509](https://github.com/gravity-ui/onboarding/commit/38af509a86b594fcf2380ed03b281975e2d6371c))


### Features

* trigger release ([ac23692](https://github.com/gravity-ui/onboarding/commit/ac236921b1376e964d161adf1d23c4679923c913))
