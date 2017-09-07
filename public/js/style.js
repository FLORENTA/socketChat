window.addEventListener("load", function() {

    var regexpHomePage = /^\/$/;
    var regexpLoginPage = /\/login$/;

    if (!regexpHomePage.test(location.pathname) && !regexpLoginPage.test(location.pathname)) {

        if (window.innerWidth < 1024) {
            document.querySelector("nav ul").setAttribute("id", "nav_mobile");
        }
        else {
            document.querySelector("nav ul").setAttribute("id", "nav_desktop");
        }
    }

});
