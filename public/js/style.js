window.addEventListener("load", function() {

    var navUlElt = document.querySelector("nav ul");
    var footerElt = document.querySelector("footer");
    var containerElt = document.querySelector(".container");

    if (window.innerWidth < 1024) {

        navUlElt.setAttribute("id", "nav_mobile");
        var connectedMembersElt = document.getElementById("connected_members");

        document.getElementById("burger").addEventListener("click", function(){

            if(parseFloat(getComputedStyle(navUlElt).left) < 0){
                navUlElt.style.left = "0";
            }
            else{
                navUlElt.style.left = "-100%";
            }
        });

        document.getElementById("people").addEventListener("click", function(){

            if(parseFloat(getComputedStyle(connectedMembersElt).left) < 0){
                connectedMembersElt.style.left = "0";
            }
            else{
                connectedMembersElt.style.left = "-75vw";
            }

        });
    }
    else {
        navUlElt.setAttribute("id", "nav_desktop");
    }

    if(parseFloat(getComputedStyle(containerElt).getPropertyValue("height")) > window.innerHeight * .75){

        footerElt.style.position = "relative";

    }

});
