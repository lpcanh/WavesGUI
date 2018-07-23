(function () {
    'use strict';

    const Handlebars = require('handlebars');

    // TODO @xenohunter : remove that when icons are in @dvshur's service
    const ASSET_IMAGES_MAP = {
        [WavesApp.defaultAssets.WAVES]: '/img/assets/waves.svg',
        [WavesApp.defaultAssets.BTC]: '/img/assets/bitcoin.svg',
        [WavesApp.defaultAssets.ETH]: '/img/assets/ethereum.svg',
        [WavesApp.defaultAssets.LTC]: '/img/assets/ltc.svg',
        [WavesApp.defaultAssets.ZEC]: '/img/assets/zec.svg',
        [WavesApp.defaultAssets.EUR]: '/img/assets/euro.svg',
        [WavesApp.defaultAssets.USD]: '/img/assets/usd.svg',
        [WavesApp.defaultAssets.DASH]: '/img/assets/dash.svg',
        [WavesApp.defaultAssets.BCH]: '/img/assets/bitcoin-cash.svg',
        [WavesApp.defaultAssets.TRY]: '/img/assets/try.svg',
        [WavesApp.defaultAssets.XMR]: '/img/assets/xmr.svg',
        [WavesApp.otherAssetsWithIcons.EFYT]: '/img/assets/efyt.svg',
        [WavesApp.otherAssetsWithIcons.WNET]: '/img/assets/wnet.svg'
    };

    const COLORS_MAP = {
        A: '#39a12c',
        B: '#6a737b',
        C: '#e49616',
        D: '#008ca7',
        E: '#ff5b38',
        F: '#ff6a00',
        G: '#c74124',
        H: '#00a78e',
        I: '#b01e53',
        J: '#e0c61b',
        K: '#5a81ea',
        L: '#72b7d2',
        M: '#a5b5c3',
        N: '#81c926',
        O: '#86a3bd',
        P: '#c1d82f',
        Q: '#5c84a8',
        R: '#267e1b',
        S: '#fbb034',
        T: '#ff846a',
        U: '#47c1ff',
        V: '#00a0af',
        W: '#85d7c6',
        X: '#8a7967',
        Y: '#26c1c9',
        Z: '#72d28b'
    };

    const DEFAULT_COLOR = '#96bca0';

    const TEMPLATE_PATH = 'modules/wallet/modules/portfolio/directives/portfolioRow/row.hbs';
    const SELECTORS = {
        AVAILABLE: 'js-balance-available',
        IN_ORDERS: 'js-balance-in-orders',
        BASE_ASSET_BALANCE: 'js-balance-in-base-asset',
        EXCHANGE_RATE: 'js-exchange-rate',
        CHANGE_24: 'js-change-24',
        ACTIONS: 'js-actions',
        BUTTONS: {
            SEND: {
                MAIN: 'js-button-send',
                TITLE: 'js-button-send-title'
            },
            RECEIVE: {
                MAIN: 'js-button-receive',
                TITLE: 'js-button-receive-title'
            },
            DEX: {
                MAIN: 'js-button-open-in-dex',
                TITLE: 'js-button-open-in-dex-title'
            },
            TOGGLE_SPAM: {
                MAIN: 'js-button-toggle-spam',
                TITLE: 'js-button-toggle-spam-title'
            }
        }
    };

    class PortfolioRow {

        constructor($templateRequest, $element, utils, waves, user, modalManager, $state) {

            if (!PortfolioRow.templatePromise) {
                PortfolioRow.templatePromise = $templateRequest(TEMPLATE_PATH)
                    .then((html) => Handlebars.compile(html));
            }

            this.$state = $state;
            /**
             * @type {ModalManager}
             */
            this.modalManager = modalManager;
            /**
             * @type {JQuery}
             */
            this.$node = $element;
            /**
             * @type {HTMLElement}
             */
            this.node = $element.get(0);
            /**
             * @type {IBalanceDetails}
             */
            this.balance = null;
            /**
             * @type {app.utils}
             */
            this.utils = utils;
            /**
             * @type {Waves}
             */
            this.waves = waves;
            /**
             * @type {User}
             */
            this.user = user;
            /**
             * @type {boolean}
             */
            this.canShowDex = null;
        }

        $postLink() {
            PortfolioRow.templatePromise.then((template) => {

                const firstAssetChar = this.balance.asset.name.slice(0, 1);

                const html = template({
                    assetIconPath: ASSET_IMAGES_MAP[this.balance.asset.id],
                    firstAssetChar,
                    charColor: COLORS_MAP[firstAssetChar.toUpperCase()] || DEFAULT_COLOR,
                    assetName: this.balance.asset.name,
                    SELECTORS: { ...SELECTORS },
                    canShowDex: this.canShowDex,
                    canShowToggleSpam: this._canShowToggleSpam()
                });

                this.node.innerHTML = html;

                let balance = this.balance;

                Object.defineProperty(this, 'balance', {
                    get: () => balance,
                    set: (value) => {
                        if (this.balance.asset.id !== value.asset.id ||
                            !this.balance.available.getTokens().eq(value.available.getTokens()) ||
                            !this.balance.inOrders.getTokens().eq(value.inOrders.getTokens())
                        ) {
                            balance = value;
                            this._onUpdateBalance();
                        }
                    }
                });

                this._onUpdateBalance();

                this._setHandlers();
            });
        }

        _onUpdateBalance() {
            this._updateBalances();
            this._initSpamState();

            const balance = this.balance;
            const baseAssetId = this.user.getSetting('baseAssetId');

            if (baseAssetId === balance.asset.id) {
                this.node.querySelector(`.${SELECTORS.CHANGE_24}`).innerHTML = '—';
                this.node.querySelector(`.${SELECTORS.EXCHANGE_RATE}`).innerHTML = '—';
                this.node.querySelector(`.${SELECTORS.BASE_ASSET_BALANCE}`).innerHTML = '—';

                return null;
            }

            this.waves.utils.getChange(balance.asset.id, baseAssetId)
                .then(change24 => {
                    this.node.querySelector(`.${SELECTORS.CHANGE_24}`).innerHTML = `${change24.toFixed(2)}%`;
                });

            this.waves.utils.getRate(balance.asset.id, baseAssetId)
                .then(rate => {
                    const baseAssetBalance = balance.available.getTokens().times(rate).toFixed(2);

                    this.node.querySelector(`.${SELECTORS.EXCHANGE_RATE}`).innerHTML = rate.toFixed(2);
                    this.node.querySelector(`.${SELECTORS.BASE_ASSET_BALANCE}`).innerHTML = baseAssetBalance;
                });
        }

        _setHandlers() {
            this.$node.on('click', `.${SELECTORS.BUTTONS.SEND.MAIN}`, () => {
                this.modalManager.showSendAsset({ assetId: this.balance.asset.id });
            });

            this.$node.on('click', `.${SELECTORS.BUTTONS.DEX.MAIN}`, () => {
                this.$state.go('main.dex', this._getSrefParams(this.balance.asset));
            });

            this.$node.on('click', `.${SELECTORS.BUTTONS.RECEIVE.MAIN}`, () => {
                this.modalManager.showReissueModal(this.balance.asset.id);
            });

            this.$node.on('click', `.${SELECTORS.BUTTONS.TOGGLE_SPAM.MAIN}`, () => {
                this.user.toggleSpamAsset(this.balance.asset.id);
                this._initSpamState();
            });
        }

        _initSpamState() {
            if (!this._canShowToggleSpam()) {
                return null;
            }

            const spam = this.user.getSetting('wallet.portfolio.spam') || [];
            const isSpam = spam.includes(this.balance.asset.id);

            const toggleSpam = this.node.querySelector(`.${SELECTORS.BUTTONS.TOGGLE_SPAM.MAIN}`);

            toggleSpam.classList.toggle('icon-hide', isSpam);
            toggleSpam.classList.toggle('icon-show', !isSpam);
        }

        /**
         * @param {Asset} asset
         * @private
         */
        _getSrefParams(asset) {
            this.utils.openDex(asset.id);
        }

        _updateBalances() {
            const asset = this.balance.asset;
            const available = this.balance.available.getTokens();
            const inOrders = this.balance.inOrders.getTokens();
            const availableHtml = this.utils.getNiceNumberTemplate(available, asset.precision, true);
            const inOrdersHtml = this.utils.getNiceNumberTemplate(inOrders, asset.precision);

            this.node.querySelector(`.${SELECTORS.AVAILABLE}`).innerHTML = availableHtml;
            this.node.querySelector(`.${SELECTORS.IN_ORDERS}`).innerHTML = inOrdersHtml;
        }

        _canShowToggleSpam() {
            return this.balance.asset.id !== WavesApp.defaultAssets.WAVES;
        }

    }

    PortfolioRow.$inject = ['$templateRequest', '$element', 'utils', 'waves', 'user', 'modalManager', '$state'];

    angular.module('app.wallet.portfolio').component('wPortfolioRow', {
        controller: PortfolioRow,
        bindings: {
            balance: '<',
            canShowDex: '<'
        },
        scope: false
    });

})();
