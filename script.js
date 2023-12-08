// ==UserScript==
// @name         CookieClicker
// @namespace
// @version      1
// @description  Cookie clicker overlay
// @author       Nok
// @match        https://orteil.dashnet.org/cookieclicker/
// @grant        none
// ==/UserScript==

class Data {
    constructor() {
        this.currentChips = 0;
        this.totalChips = 0;
        this.money = 0;
        this.moneyPerSecond = 0;
        this.products = [];
        this.upgrades = {
            normal: {}, // name: { enabled: true/false, DOMnode: DOMnode }
            tech: {},
            seasonal: {},
            special: {},
        };
        this.upgradeAvailable = false; // If an upgrade can be bought and the buyAllButton is enabled
        this.overhead = 20;
        this.stockData = {};
        this.stockPrices = [];
        this.boughtStock = {};
    }

    restore(data) {
        this.currentChips = data.currentChips;
        this.totalChips = data.totalChips;
        this.money = data.money;
        this.moneyPerSecond = data.moneyPerSecond;
        this.products = data.products;
        this.upgrades = data.upgrades;
        this.upgradeAvailable = data.upgradeAvailable;
        this.overhead = data.overhead;
        this.stockData = data.stockData;
        this.stockPrices = data.stockPrices;
        this.boughtStock = data.boughtStock;
    }

    setCurrentChips(amount) {
        this.currentChips = amount;
    }

    setTotalChips(amount) {
        this.totalChips = amount;
    }

    setMoney(amount) {
        this.money = amount;
    }

    setMoneyPerSecond(amount) {
        this.moneyPerSecond = amount;
    }

    calculateProductData(id) {
        const product = this.products[id];
        const percentage = Math.min(99.9, this.money / product.productPrice * 100); // 0 - 99 %
        const timeLeft = Math.max(0, parseInt((product.productPrice - this.money) / this.moneyPerSecond, 10)); // >= 0
        const totalTime = Math.max(0, parseInt(product.productPrice) / this.moneyPerSecond, 10); // >= 0
        const incomePerMoney = Math.round(product.mps / (product.productPrice || 1) * 100000);

        return {percentage, timeLeft, totalTime, incomePerMoney};
    }

    getProductData(id) {
        return {...this.products[id], ...this.calculateProductData(id)};
    }

    setProductData(id, product) {
        this.products[id] = {...this.products[id], ...product}
    }

    getUpgrades(type) {
        if (type === "seasonal") return this.upgrades[type];
        return Object.values(this.upgrades[type]); // Object to array
    }

    updateUpgrade(type, name, upgrade) {
       this.upgrades[type][name] = { ...this.upgrades[type][name], ...upgrade };
    }

    deleteUpgrade(type, name) {
        delete this.upgrades[type][name];
    }

    getIncomePerMoneyEfficiency(product) {
        const products = [...this.products].filter(el=>!isNaN(el.mps)).map(el=>this.getProductData(el.id));
        let total = 0;
        for (const p of products) {
            total += p.incomePerMoney;
        }
        return (product.incomePerMoney / (total || 1)); // %
    }

    calculateEfficiency(productData) {
        //console.log(productData);
        // We don't like cursor
        const total = (
            // Cheaper than the money per second (x2), so we should buy
            ((data.moneyPerSecond * 2 > productData.productPrice) * 1e99) +
            // More percentage of Mps is better
            ((!isNaN(productData.percentageOfMps)) ? productData.percentageOfMps / 200 * (productData.id * productData.id / 10) : 0) +
            // More income per money is better
            ((!isNaN(productData.incomePerMoney)) ? this.getIncomePerMoneyEfficiency(productData) * productData.mps : 0)
        );
        productData.total = total; // TODO: Make a logger/debug class
        return total;
    }

    getMostEfficientProduct() {
        // Sort the products based on efficiency
        const undefinedProducts = [];
        const products = [...this.products].reverse().map((el) => {
            const productData = this.getProductData(el.id);
            if (isNaN(productData.incomePerMoney)) {undefinedProducts.push(productData);} // #sideEffects d;)

            return productData;
        }).sort((productData1, productData2) => {
            if (isNaN(productData2.incomePerMoney)) return -1;
            return this.calculateEfficiency(productData2) - this.calculateEfficiency(productData1);
        });

        // Get the cheapest undefined product
        let cheapestundefinedProduct = undefined;
        for (const undefinedProduct of undefinedProducts) {
            if (undefinedProduct.id === 0) continue; // Skip cursor

            if (cheapestundefinedProduct === undefined || cheapestundefinedProduct.id > undefinedProduct.id) {
                cheapestundefinedProduct = undefinedProduct;
            }
        }

        // Return undefined product if time left is < 0.5 of best product time left or if productData totalTime is > 1 minute and undefined < 20 minutes
        // Else return most efficient product (first in products)
        for (const productData of products) {
            if (!isNaN(productData.incomePerMoney)) {
                if (cheapestundefinedProduct && (productData.totalTime * 2 >= cheapestundefinedProduct.totalTime || (productData.totalTime > 60 && cheapestundefinedProduct.totalTime < 20 * 60))) { // TODO: Calculate when its worth to do this
                    return {product: cheapestundefinedProduct, products};
                }
                return {product: productData, products};
            }
        }

        return {product: products[0], products};
    }
}

/*
*
* UTILITY FUNCTIONS
*
*/

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function acceptPromt() {
    document.getElementById("promptOption0").click();
}

function getBuyAllButton() {
    return document.getElementById("storeBuyAllButton");
}

function getProducts() {
    return [...document.querySelectorAll('div.product')].filter((el)=> {
        return !el.className.includes("toggledOff");
    });
}

function getProductId(product) {
    return parseInt(product.id.split("product")[1]);
}

function getProductById(id) {
    return getProducts()[id];
}

function stringToInt(str) {
    // NOTE: praseInt does not work with scientific representations
    return parseFloat(str.replace(/,/g, ""), 10);
}

function secondsToTime(sec) {
    if (sec / 86400 > 1) {
        return `${Math.round(sec/86400, 10)}d`;
    } else if (sec / 3600 > 1) { // Hours
        return `${Math.round(sec/3600, 10)}h`;
    } else if (sec / 60 > 1) { // Minute
        return `${Math.round(sec/60, 10)}m`;
    } else { // Sec
        return `${sec}s`;
    }
}

function getHeavenlyInfo(heavenlyUpgrade) {
    heavenlyUpgrade.onmouseover();

    const tooltip = document.getElementById("tooltip");
    const chips = stringToInt(tooltip.querySelector(".price.heavenly").innerText);

    return chips;
}

function getTechUpgradeInfo(DOMnode) {
    DOMnode.onmouseover();
    const name = document.querySelector("#tooltip div .name").innerText;
    const enabled = DOMnode.className.includes("enabled");
    const hasWarning = !!document.querySelector("#tooltip div .warning");
    DOMnode.onmouseout();

    return { name, enabled, hasWarning };
}

function getUpgradeInfo(DOMnode) {
    DOMnode.onmouseover();
    const name = document.querySelector("#tooltip div .name").innerText;
    const enabled = DOMnode.className.includes("enabled");
    DOMnode.onmouseout();

    return { name, enabled };
}

function getProductInfo(id) {
    // Open tooltip via game
    Game.tooltip.dynamic = 1;
    Game.tooltip.draw(this, () => { return Game.ObjectsById[id].tooltip(); }, 'store');
    Game.tooltip.wobble();

    const tooltip = document.getElementById('tooltip');
    const data = tooltip.getElementsByTagName('b');
    const mpsElement = data[0] || document.createElement('b'); // Money per second
    const percentageOfMpsElement = data[2] || document.createElement('b'); // Percentage of total mps
    const mps = stringToInt(mpsElement.innerText);
    // TODO: Grandma's should include the dps they give to others
    const percentageOfMps = stringToInt(percentageOfMpsElement.innerText.slice(0, -1)); // Remove %

    // Hide tooltip
    Game.tooltip.hide();

    return {mps, percentageOfMps};
}

function getStockInfo() {
    // Overhead
    let overhead = 0.20;
    const brokerElement = document.getElementById("bankBrokers");
    if (brokerElement) {
        // Open broker tooltip
        brokerElement.onmouseover();

        const brokerModal = document.getElementById("tooltip");
        if (brokerModal) {
            const overheadElement = brokerModal.querySelectorAll(".description B")[2];
            overhead = stringToInt(overheadElement.innerText) / 100; // Normalized
        }

        // Close tooltip
        brokerElement.onmouseout();
    }

    // Stock info
    const stockData = {};
    const stockPrices = {};
    const stockElements = document.querySelectorAll(".bankGood");
    for (const stockElement of stockElements) {
        const sdata = stockElement.querySelectorAll(".bankSymbol");
        if (sdata) {
            const name = sdata[0].innerText.split(" ")[0];
            const value = stringToInt(sdata[1].innerText.split(" $")[1]);
            const bothStock = sdata[2].innerText.split("/");
            const curStock = stringToInt(bothStock[0].split(": ")[1]);
            const maxStock = stringToInt(bothStock[1]);
            stockData[name] = {
                curStock, maxStock,
            }
            stockPrices[name] = value;

        }
    }

    return {
        overhead,
        stockData,
        stockPrices,
    }
};

function plantFarm(id= 5) {
    const seedName = `gardenSeed-${id}`;
    const seed = document.querySelector(`#${seedName}`);
    const cols = 6;
    const rows = 6;
    for (let i = 0; i < rows; ++i) {
        for (let j = 0; j < cols; ++j) {
            const tileID = `gardenTile-${i}-${j}`;
            const tile = document.querySelector(`#${tileID}`);
            // console.log(tileID);
            // Timeout to prevent laggspike
            window.setTimeout(()=>{
                //window.setTimeout(()=>{seed.click();}, 0);
                //window.setTimeout(()=>{tile.click();}, 10);
                seed.click();
                tile.click();
            }, 100 * (i * rows + j));
        }
    }
};

function buyStock(name) {
    // Buy stock
    const stockElements = document.querySelectorAll(".bankGood");
    for (const stockElement of stockElements) {
        const sdata = stockElement.querySelectorAll(".bankSymbol");
        if (sdata) {
            const curName = sdata[0].innerText.split(" ")[0];

            if (curName == name) {
                // Get button and buy
                const buyButtons = stockElement.querySelectorAll(".bankButtonBuy");
                const maxBuyButton = buyButtons[buyButtons.length - 1];

                // Note: We do not check if we have the cookies to buy stock
                maxBuyButton.click();

                // Return new price
                const value = stringToInt(sdata[1].innerText.split(" $")[1]);
                return value;
            }
        }
    }
}

function sellStock(name) {
    const stockElements = document.querySelectorAll(".bankGood");
    for (const stockElement of stockElements) {
        const sdata = stockElement.querySelectorAll(".bankSymbol");
        if (sdata) {
            const curName = sdata[0].innerText.split(" ")[0];

            if (curName == name) {
                const sellButtons = stockElement.querySelectorAll(".bankButtonSell");
                const sellAllButton = sellButtons[sellButtons.length - 1];

                // Note: We do not check if we have the cookies to buy stock
                sellAllButton.click();
                break;
            }
        }
    }
}


/*
*
* MAIN LOOP FUNCTIONS
*
*/


function render() {
    const productsElements = getProducts();

    for (const productElement of productsElements) {
        const productId = getProductId(productElement);
        const productData = data.getProductData(productId);
        // Progress bar
        const progressbar = productElement.querySelector(`#${preFix}progressbar`) || createProgressbar(productElement);
        progressbar.style.width = `${productData.percentage}%`;

        // Timer
        const timer = progressbar.querySelector(`#${preFix}timer`);
        timer.innerText = secondsToTime(productData.timeLeft);

        // Mps
        const incomePerMoney = productData.incomePerMoney;
        if (!isNaN(incomePerMoney)) {
            const mpsElement = progressbar.querySelector(`#${preFix}mps`).innerText = incomePerMoney;
        }
    }
}

function buyUpgrades() {
    // TODO: Move special upgrade data search to updateUpgradeData
    // TODO: Dont' have blocking while loops

    // Special upgrades
    // We can't click the element because they use canvas for it
    // Santa
    if (Game.specialTabs.includes('santa')) {
        Game.specialTab = 'santa';
        Game.ToggleSpecialMenu(true);
        // While the evolve cost <= moneyPerSecond: evolve
        const button = document.querySelector("#specialPopup .optionBox a");
        let cost = 0;
        let attempt = 0;
        do {
            const done = document.querySelector("#specialPopup H3").innerText === "Final Claus";
            if (done) { break; }
            cost = stringToInt(document.querySelector("#specialPopup .optionBox a div div").innerText.split(" cookie")[0]);
            button.click();
        } while(cost <= data.moneyPerSecond && ++attempt < 10); // attempt is there to prevent blocking
        Game.ToggleSpecialMenu(false);
    }
    // Dragon
    if (Game.specialTabs.includes('dragon')) {
        Game.specialTab = 'dragon';
        Game.ToggleSpecialMenu(true);
        // While the sac cost <= moneyPerSecond: sac
        const button = document.querySelector("#specialPopup .optionBox a");
        let cost = 0;
        let hatched = false;
        let attempt = 0;
        do {
            const costText = document.querySelector("#specialPopup .optionBox a div div")?.innerText;
            if (costText && costText.includes(" cookie")) {
                cost = stringToInt(costText.split(" cookie")[0]);
                button.click();
            } else {
                // TODO: Buy if has 100 of all till Prism then set 2x all buff
                hatched = true;
                break;
            }
        } while(cost <= data.moneyPerSecond && ++attempt < 10); // attempt is there to prevent blocking

        if (hatched) {
            // Set buff to milk
            const auras = document.querySelectorAll("#specialPopup .crate.enabled");
            for (const aura of auras) {
                aura.onmouseover();
                const name = document.querySelector("#tooltip h4").innerText;
                if (name === "No aura") {
                    aura.click();
                    const promt = document.getElementById("prompt");
                    const upgrades = promt.querySelectorAll("div.crate.enabled");
                    // Select aura
                    for (const upgrade of upgrades) {
                        upgrade.onmouseover();
                        const currentName = promt.querySelector("#dragonAuraInfo h4").innerText;
                        upgrade.onmouseout();

                        //  set 2x all buff when possible
                        if (currentName === "Breath of Milk") {
                            upgrade.click();
                            break;
                        }
                    }
                    // Buy the aura
                    acceptPromt();
                }
                aura.onmouseout();
            }
        }
        Game.ToggleSpecialMenu(false);
    }

    // Seasonal upgrades
    const upgradesByName = data.getUpgrades("seasonal");
    const love = upgradesByName["Lovesick biscuit"];
    const festive = upgradesByName["Festive biscuit"];
    const bunny = upgradesByName["Bunny biscuit"];
    const ghostly = upgradesByName["Ghostly biscuit"];

    // Buy love if not done
    if (love && !love.done && !love.currentlySelected && love.enabled) {
        love.DOMnode.click();
        console.log("Seasonal upgrade:", love.name, upgradesByName);
    // Buy festive if love done and festive not done
    } else if (festive && love.done && !festive.done && !festive.currentlySelected && festive.enabled) {
        festive.DOMnode.click();
        console.log("Seasonal upgrade:", festive.name, upgradesByName);
    // Buy ghostly if bunny done and ghostly not done
    } else if (ghostly && festive.done && !ghostly.done && !ghostly.currentlySelected && ghostly.enabled) {
        ghostly.DOMnode.click();
        console.log("Seasonal upgrade:", ghostly.name, upgradesByName);
    // Buy bunny if festive done and bunny not done
    } else if (bunny && ghostly.done && !bunny.done && !bunny.currentlySelected && bunny.enabled) {
        bunny.DOMnode.click();
        console.log("Seasonal upgrade:", bunny.name, upgradesByName);
    }

    // Buy tech upgrade
    const techUpgrades = data.getUpgrades("tech");
    for (const upgrade of techUpgrades) {
        // Prevent grandmapocalypse
        if (!upgrade.hasWarning) {
            if (!upgrade.DOMnode.click) {
                console.log(upgrade, upgrade.name);
            }
            upgrade.DOMnode?.click?.();
            data.deleteUpgrade("tech", upgrade.name);
        }
    }

    // TODO: Calculate upgrade values
    if (data.upgradeAvailable) {
        const buyAllButton = getBuyAllButton();
        buyAllButton.click();
    }
    const upgrades = data.getUpgrades("normal");
    for (const upgrade of upgrades) {
        if (upgrade.enabled) {
            upgrade.DOMnode.click();
            data.deleteUpgrade("normal", upgrade.name);
        }
    }
}

function buyHeavenlyUpgrades() {
    // Get DOM Elements
    const heavenlyUpgrades = document.querySelectorAll('.heavenly.upgrade');
    const spendableChips = stringToInt(document.querySelector("#ascendHCs .price.heavenly").innerText);

    // Get prices
    const heavelyPrices = [];
    for (const upgrade of heavenlyUpgrades) {
        if (!upgrade.className.includes("enabled") && !upgrade.className.includes("ghosted")) {
            heavelyPrices.push({upgrade: upgrade, price: getHeavenlyInfo(upgrade)});
        }
    }

    // Sort prices from high to low
    heavelyPrices.sort((el1, el2) => (el1.price >= el2.price) ? -1 : 1);

    // Buy first upgrade we can buy
    for (const upgrade of heavelyPrices) {
        if (upgrade.price <= spendableChips) {
            upgrade.upgrade.click();
            console.log(upgrade);
            break;
        }
    }

    if (heavelyPrices.length === 0) {
        return true;
    }

    return spendableChips < heavelyPrices[heavelyPrices.length - 1].price;
}

function updateUpgradeData() {
    // Seasonal upgrades
    const seasonalUpgrades = document.querySelectorAll('#toggleUpgrades div');
    for (const upgrade of seasonalUpgrades) {
        if (!upgrade.className.includes("selector") && !upgrade.className.includes("pieTimer")) {
            upgrade.onmouseover();
            // Not a Seasonal
            const description = document.querySelector("#tooltip div .description div");
            if (!description) {
                continue;
            }
            const name = document.querySelector("#tooltip div .name").innerText;
            const currentlySelected = description.innerText.includes("(Click again to cancel season)");
            const statuses = [...document.querySelectorAll("#tooltip div b")].slice(currentlySelected, -2);
            let done = true;
            for (const status of statuses) {
                // E.G. 1/2 = false; 2/2 = true
                const state = status.innerText.split("/");
                if (state[0] !== state[1]) {
                    done = false;
                    break;
                }
            }
            // TODO: Create get data function
            data.updateUpgrade("seasonal", name, {
                name,
                enabled: upgrade.className.includes("enabled"),
                done,
                currentlySelected,
                DOMnode: upgrade
            });
            upgrade.onmouseout();
        }
    }
    // console.log(data.getUpgrades("seasonal"));

    // Tech upgrade
    const techUpgrade = document.querySelector("#techUpgrades div");
    if (techUpgrade) {
        const { name, enabled, hasWarning } = getTechUpgradeInfo(techUpgrade);
        data.updateUpgrade("tech", name, {
            name,
            enabled,
            hasWarning,
            DOMnode: techUpgrade
        });
    }
    // data.updateUpgrade("tech", "dummy", {
        // name: "dummy",
        // enabled: false,
        // hasWarning: true,
        // DOMnode: null
    // });
    // console.log(data.getUpgrades("tech"));

    // Check if the buyAllButton (heavenly upgrade) is present
    const buyAllButton = getBuyAllButton();
    if (buyAllButton) {
        const upgrades = document.querySelectorAll('#upgrades div.enabled');
        data.upgradeAvailable = (upgrades.length > 0)
    } else {
        // Normal upgrades
        const upgrades = document.querySelectorAll('#upgrades div');
        for (const upgrade of upgrades) {
            const { name, enabled } = getUpgradeInfo(upgrade);
            data.updateUpgrade("normal", name, {
                name,
                enabled,
                DOMnode: upgrade,
            });
        }
    }
    // console.log(data.getUpgrades("normal"));
}

function updateProductData() {
    const productsElements = getProducts();
    for (const productElement of productsElements) {
        const productId = getProductId(productElement);

        data.setProductData(productId, {
            id: productId,
            productPrice: stringToInt(productElement.querySelector(".content .price").innerText),
            ...getProductInfo(productId),
        });
    }

    const {product, products} = data.getMostEfficientProduct();
    // console.log(product, products);
}

function updateStock() {
    const { overhead, stockData, stockPrices } = getStockInfo();
    data.overhead = overhead;
    data.stockData = stockData;
    data.stockPrices.unshift(stockPrices);

    const maximumBackup = 100;
    if (data.stockPrices.length > maximumBackup) {
        data.stockPrices.length = maximumBackup;
    }

    let i = 0;
    // TODO: Get Bank level
    const bankLevel = 10;
    for (const name in data.stockData) {
        const stock = data.stockData[name];
        const prices = data.stockPrices.map((stockPrices) => stockPrices[name]);
        const curPrice = prices[0];
        const avgPrice = prices.reduce((a,b) => a + b) / prices.length;
        // TODO: Resting Value = cheat, so use something else
        const restingValue = 10 * (i + 1) + bankLevel;

        if (prices.length < 60) continue; // To little data

        console.log(name)
        console.log(curPrice, curPrice * (1 + data.overhead), avgPrice, avgPrice * (1 + overhead), stock["curStock"], stock["maxStock"], data.boughtStock[name])

        console.log("Will buy:", curPrice * (1 + data.overhead) < avgPrice, stock["curStock"] < stock["maxStock"], (curPrice < data.boughtStock[name] || !data.boughtStock[name]));
        console.log("Will sell:", curPrice > avgPrice * (1 + data.overhead), stock["curStock"] > 0, data.boughtStock[name] < curPrice);
        // Buy stock if price below avg
        if (
            curPrice * (1 + data.overhead) < avgPrice &&
            stock.curStock < stock.maxStock &&
            (curPrice < data.boughtStock[name] || !data.boughtStock[name]) &&
            curPrice < restingValue * 0.5) { // 50% under resting value
            // If we buy stock for 1 and later stock for 3 we set the price to 3
            const newPrice = buyStock(name);
            if (!data.boughtStock[name]) {
                data.boughtStock[name] = newPrice;
            }
        }
        // Sell Stock if better price
        else if (curPrice > avgPrice * (1 + data.overhead) && stock["curStock"] > 0 && data.boughtStock[name] < curPrice) {
            delete data.boughtStock[name];
            sellStock(name);
        }

        i++;
    }
}

async function update() {
    const state = (document.querySelector("#game.ascending")) ? STATES.heavenly : STATES.normal;
    console.log(state);

    if (state === STATES.normal) {
        // Update Money
        const moneyString = document.getElementById('cookies').innerText.split("coo");
        data.setMoney(stringToInt(moneyString[0]));
        data.setMoneyPerSecond(stringToInt(moneyString[1].split(": ")[1]));

        // Update chips
        const legacyButton = document.getElementById("legacyButton");
        const currentChipsPanel = legacyButton.querySelector(".roundedPanel");
        data.setTotalChips(stringToInt(legacyButton.getElementsByTagName('B')[1].innerText));
        data.setCurrentChips((currentChipsPanel.style.display === "none") ? 0 : stringToInt(currentChipsPanel.innerText));

        // Update product data if we have no data, else we do it on click
        if(data.products.length === 0) { onClick(); await sleep(100);}

        // Calculate most efficient product
        const {product: mostEfficientProduct} = data.getMostEfficientProduct()
        const mostEfficientProductElement = getProductById(mostEfficientProduct.id);
        if (mostEfficientProductElement === undefined) {
            await sleep(100);
            return;
        }

        // Buy most efficient product
        if (mostEfficientProductElement.className.includes("enabled")) {
            mostEfficientProductElement.click();
        }

        // But upgrades
        // TODO: Don't hover every second
        buyUpgrades();

        // Time to ascend
        if (data.currentChips > (data.totalChips / 10) || (data.currentChips > 1)) {
            legacyButton.click();
            acceptPromt();
            await sleep(5000);
            return;
        }

        const goldenCookie = document.querySelector(".shimmer");
        if (goldenCookie) { goldenCookie.click(); }

        // Fortune cookie
        const newsTicker = document.querySelector("#commentsText .commentsText.risingUp span.fortune");
        if (newsTicker) { newsTicker.click(); }

        // Render
        render(data);
    } else if (state === STATES.heavenly) {
        // Buy heavenly upgrades
        const done = buyHeavenlyUpgrades();
        console.log(done);

        // Can't buy any more, so we go back
        if (done) {
            const ascendButton = document.getElementById("ascendButton");
            ascendButton.click();
            acceptPromt();
            await sleep(8000);
            return;
        }
    }
}

function everyMinute() {
    // Stock
    console.clear();
    updateStock();
    console.log(data);

    // Backup data
    localStorage.setItem('CookieClickerBot', JSON.stringify(data));
}

function onClick() {
    // Hacky way to make sure our onClick is fired after the sites onClick
    window.setTimeout(() => {
        updateProductData();
        updateUpgradeData();
        const buttons = [document.querySelector("#storeBulk100"),document.querySelector("#storeBulk10"),document.querySelector("#storeBulk1")];
        const selectedButton = buttons.reduce((selected, cur) => (cur.classList.contains("selected")) ? cur : selected, buttons[0]);
        for (const button of buttons) {
            const buttonValue = parseInt(button.innerText, 10);
            const selectedButtonValue = parseInt(selectedButton.innerText, 10);
            const buildingCost = data.products.reduce((sum, cur) => sum + cur.productPrice, 0) / data.products.length;
            if (buttonValue !== selectedButtonValue && ((buttonValue < selectedButtonValue && buildingCost * selectedButton > data.money) || buttonValue > selectedButtonValue && buildingCost * buttonValue <= data.money) ) {

                console.log("button", button.innerText);
                button.click();
                return;
            }
        }
    }, 10);
}

function createProgressbar(domNode) {
    const progressbar = document.createElement('div');
    progressbar.id = `${preFix}progressbar`;
    Object.assign(progressbar.style, {
        backgroundColor: "rgba(20, 200, 20, 0.2)",
        width: "99%",
        height: "100%",
    });

    const timer = document.createElement('span');
    timer.id = `${preFix}timer`;
    Object.assign(timer.style, {
        left: "75%",
        top: "65%",
        position: "absolute"
    })

    const mps = document.createElement('span');
    mps.id = `${preFix}mps`;
    Object.assign(mps.style, {
        left: "75%",
        top: "15%",
        position: "absolute"
    })

    progressbar.appendChild(timer);
    progressbar.appendChild(mps);
    domNode.appendChild(progressbar);

    return progressbar;
}

// Create empty global data object
const data = new Data();
if (window.localStorage.getItem("CookieClickerBot")) {
    data.restore(JSON.parse(window.localStorage.getItem("CookieClickerBot")));
}
const STATES = { normal: "normal", heavenly: "heavenly" };
const preFix = "idle-bot-";

{
    document.addEventListener('click', onClick);
    // TODO: Wait for coockie clicker to load, (since its not loaded when onLoad is called)
    // Since cookie clicker is not done loading when window.load is called we just wait a second d;)
    window.setTimeout(() => {
        console.log(data);
        const minuteUpdateInterval = window.setInterval(everyMinute, 60 * 1000);
    }, 1000);

    await sleep(1000);
    while(true) {
        await update();
        await sleep(100);
    }

    // Create plant button
    const button = document.createElement("BUTTON");
    const section = document.querySelector("#sectionLeft");

    button.style.width = '100%';
    button.style.height = '30px';
    button.style.position = 'absolute';
    button.style.zIndex = 10;
    button.innerText = 'Plant gold';
    button.onclick = (evt)=>{plantFarm();};
    section.appendChild(button);
}
