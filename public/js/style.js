window.addEventListener("load", function() {

    var navUlElt = document.querySelector("nav ul");

    if (window.innerWidth < 1024) {

        navUlElt.setAttribute("id", "nav_mobile");

        document.getElementById("burger").addEventListener("click", function(){

            if(parseFloat(getComputedStyle(navUlElt).left) < 0){
                navUlElt.style.left = "0";
            }
            else{
                navUlElt.style.left = "-100%";
            }
        });
    }
    else {
        navUlElt.setAttribute("id", "nav_desktop");
    }

});
