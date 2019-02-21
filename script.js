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
		this.data = [];
	}

	setMoney(amount) {
		this.money = amount;
	}

	setMoneyPerSecond(amount) {
		this.moneyPerSecond = amount;
	}

    calculateProductData(id) {
		const data = this.data[id];
        const percentage = Math.min(99.9, this.money / data.productPrice * 100); // 0 - 99 %
		const timeLeft = Math.max(0, parseInt((data.productPrice - this.money) / this.moneyPerSecond, 10)); // >= 0
		const incomePerMoney = Math.round(data.mps / (data.productPrice || 1) * 100000);

        return {percentage, timeLeft, incomePerMoney};
    }

	getProductData(id) {
		return {...this.data[id], ...this.calculateProductData(id)};
	}

	setProductData(id, data) {
		this.data[id] = {...this.data[id], ...data}
	}

    getMostEfficientProduct() {
        // TODO: Sort products based on efficiency, so that we can buy second most efficent when wait time is short

        const data = [...this.data].reverse();
        let mostEfficientProduct = this.data[0];
        for (const product of data) {
            const productData = this.getProductData(product.id);
            const mostEfficientProductData = this.getProductData(mostEfficientProduct.id);

            if (isNaN(mostEfficientProductData.incomePerMoney) || productData.incomePerMoney > mostEfficientProductData.incomePerMoney) {
                mostEfficientProduct = productData;
            }
        }

        return mostEfficientProduct;
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
	const mpsElement = data[0] || document.createElement('b');
	const mps = stringToInt(mpsElement.innerText);

	// Hide tooltip
	Game.tooltip.hide();

	return mps;
}

function render() {
	const productsElements = getProducts();

	for (const productElement of productsElements) {
		const productId = getProductId(productElement);
		const productData = data.getProductData(productId);
		// Progress bar
        const progressbar = productElement.querySelector("#nok-progressbar") || createProgressbar(productElement);
        progressbar.style.width = `${productData.percentage}%`;

		// Timer
		const timer = progressbar.querySelector("#nok-timer");
		timer.innerText = secondsToTime(productData.timeLeft);

		// Mps
		const incomePerMoney = productData.incomePerMoney;
		if (!isNaN(incomePerMoney)) {
			const mpsElement = progressbar.querySelector("#nok-mps").innerText = incomePerMoney;
		}
	}
}

function updateProductData() {
	const productsElements = getProducts();
	for (const productElement of productsElements) {
		const productId = getProductId(productElement);
		const mps = getProductInfo(productId);

		data.setProductData(productId, {
            id: productId,
			productPrice: stringToInt(productElement.querySelector(".content .price").innerText),
			mps,
		});
    }
	console.log(data.data);
}

function update() {
	// Update Money
    const moneyString = document.getElementById('cookies').innerText.split("coo");
	data.setMoney(stringToInt(moneyString[0]));
	data.setMoneyPerSecond(stringToInt(moneyString[1].split(": ")[1]));

	// Update product data if we have no data, else we do it on click
	if(data.data.length === 0) { updateProductData(data); }

	// Calculate most efficient product
    mostEfficientProductElement = getProductById(data.getMostEfficientProduct().id);

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
    progressbar.id = "nok-progressbar";
    Object.assign(progressbar.style, {
        backgroundColor: "rgba(20, 200, 20, 0.2)",
        width: "99%",
        height: "100%",
    });

	const timer = document.createElement('span');
	timer.id = "nok-timer";
	Object.assign(timer.style, {
		left: "75%",
		top: "65%",
		position: "absolute"
	})

	const mps = document.createElement('span');
	mps.id = "nok-mps";
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
