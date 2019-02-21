// ==UserScript==
// @name         CoockieClicker
// @namespace
// @version      1
// @description  Coockie clicker overlay
// @author       Nok
// @match        http://orteil.dashnet.org/cookieclicker/
// @grant        none
// ==/UserScript==

class Data {
    constructor() {
        this.money = 0;
        this.moneyPerSecond = 0;
        this.products = [];
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
        const incomePerMoney = Math.round(product.mps / (product.productPrice || 1) * 100000);

        return {percentage, timeLeft, incomePerMoney};
    }

    getProductData(id) {
        return {...this.products[id], ...this.calculateProductData(id)};
    }

    setProductData(id, product) {
        this.products[id] = {...this.products[id], ...product}
    }

    calculateEfficiency(productData1, productData2) {
        // TODO: Calculate incomePerMoney efficiency vs all products, then we don't need to give 2 products to this function
        // We don't like cursor
        if (productData1.id === 0) { return 0; }
        const total = (
             // Less than 20% of mps is bad with a 3 times multiplier
            (isNaN(productData1.percentageOfMps) || productData1.percentageOfMps < 20) * -3 +
            // +1 because not a cursor
            1 +
            // More income per money with a 2 times multiplier
            (!isNaN(productData1.incomePerMoney) && !isNaN(productData2.incomePerMoney) && productData1.incomePerMoney > productData2.incomePerMoney) * 2
        );
        productData1.total = total; // TODO: Make a logger/debug class
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
            return this.calculateEfficiency(productData2, productData1) - this.calculateEfficiency(productData1, productData2);
        });

        // Get the cheapestUndefindProduct
        let cheapestundefinedProduct = undefined;
        for (const undefinedProduct of undefinedProducts) {
            if (undefinedProduct.id === 0) continue; // Skip cursor

            if (cheapestundefinedProduct === undefined || cheapestundefinedProduct.id > undefinedProduct.id) {
                cheapestundefinedProduct = undefinedProduct;
            }
        }

        // Return undefined product if time left is < 0.5 of best product time left
        // Else return most efficient product (first in products)
        for (const productData of products) {
            if (!isNaN(productData.incomePerMoney)) {
                if (cheapestundefinedProduct && productData.timeLeft * 2 >= cheapestundefinedProduct.timeLeft) { // TODO: Calculate when its worth to do this
                    return {product: cheapestundefinedProduct, products};
                }
                return {product: productData, products};
            }
        }

        return {product: products[0], products};
    }
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
    return parseInt(str.replace(/,/g, ""), 10);
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
    console.log(product, products);
}

function update() {
    // Update Money
    const moneyString = document.getElementById('cookies').innerText.split("coo");
    data.setMoney(stringToInt(moneyString[0]));
    data.setMoneyPerSecond(stringToInt(moneyString[1].split(": ")[1]));

    // Update product data if we have no data, else we do it on click
    if(data.products.length === 0) { updateProductData(data); }

    // Calculate most efficient product
    const {product: mostEfficientProduct} = data.getMostEfficientProduct()
    mostEfficientProductElement = getProductById(mostEfficientProduct.id);

    // Buy most efficient product
    if (mostEfficientProductElement.className.includes("enabled")) {
        mostEfficientProductElement.click();
    }

    // Render
    render(data);
}

function onClick() {
    // Hacky way to make sure our onClick is fired after the sites onClick
    window.setTimeout(() => {
        updateProductData();
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
const preFix = "idle-bot-";

{
    document.addEventListener('click', onClick);
    // TODO: Wait for coockie clicker to load, (since its not loaded when onLoad is called)
    // Since cookie clicker is not done loading when window.load is called we just wait a second d;)
    window.setTimeout(() => {
        console.log(data);
        // Update every 100 ms
    	const updateInterval = window.setInterval(update, 100);
    	const goldenCookieInterval = window.setInterval(() => {
            const goldenCookie = document.querySelector(".shimmer");
            if (goldenCookie) { goldenCookie.click(); }
        }, 1000);
    }, 1000);
}
