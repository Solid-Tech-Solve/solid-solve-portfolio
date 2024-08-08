let navMobile = document.querySelector(".nav-mobile")
let menuButton = document.querySelector(".menu-button")
let closeButton = document.querySelector(".close")

menuButton.addEventListener('click', () => toggleMenuMobile())
closeButton.addEventListener('click', () => toggleMenuMobile())

const toggleMenuMobile = () => {
    navMobile.classList.toggle('opened')
}

const changeHeader = (string) => {
    let header = document.querySelector("header")
    let divTest = document.querySelector("#div-test")
    if(!divTest) {
        header.insertAdjacentHTML('afterend', '<div id="div-test"></div>');
    }
    let divTest2 = document.querySelector("#div-test")
    divTest2.innerText = string
    console.log(divTest2)

}


