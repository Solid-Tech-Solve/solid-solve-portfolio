let navMobile = document.querySelector(".nav-mobile");
let menuButton = document.querySelector(".menu-button");
let closeButton = document.querySelector(".close");

menuButton.addEventListener('click', () => toggleMenuMobile());
closeButton.addEventListener('click', () => toggleMenuMobile());

const toggleMenuMobile = () => {
    navMobile.classList.toggle('opened');
};
