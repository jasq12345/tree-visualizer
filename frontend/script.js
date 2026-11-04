

function counting() {

    let textarea = document.getElementById("textarea");

    let count = document.getElementById("count");



    let numbers = textarea.value.match(/-?\d+/g) || [];

    count.textContent = "The number of tree nodes: " + numbers.length;

}