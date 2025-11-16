let editingProductId = null;
const productList = document.getElementById('product-list');

function toggleVisibility(showAddForm) {
    document.getElementById('add-item-form').style.display = showAddForm ? 'block' : 'none';
    document.getElementById('all-items-section').style.display = showAddForm ? 'none' : 'block';
    document.getElementById('generate-report').style.display = showAddForm ? 'block' : 'none';
    document.getElementById('stock-report').style.display = showAddForm ? 'block' : 'none';
}

document.getElementById('add-item').addEventListener('click', () => {
    // Reset the form for adding a new item
    editingProductId = null;
    document.getElementById('add-item-form').style.display = 'block';
    document.getElementById('all-items-section').style.display = 'none';
    document.getElementById('generate-report').style.display = 'none'; // Hide the report
    document.getElementById('stock-report').style.display = 'none';   // Hide stock report
    clearForm(); // Clear the form fields
    document.getElementById('submit-item').textContent = 'Add Item';  // Reset button text
    console.log('Show Add Item form');
});

document.getElementById('add-item-form').style.display = 'block';

document.getElementById('cancel-item').addEventListener('click', () => {
    toggleVisibility(false);
    editingProductId = null;
});

document.getElementById('submit-item').addEventListener('click', () => {
    const name = document.getElementById('item-name').value;
    const price = parseFloat(document.getElementById('item-price').value);
    const stock = parseInt(document.getElementById('item-stock').value, 10);
    const category = document.getElementById('item-category').value;
    const imageUrl = document.getElementById('item-image').value || "https://via.placeholder.com/150";
    const desc = document.getElementById('description').value;

    console.log('Submit Item:', { name, price, stock, category, imageUrl, desc });

    const imageFile = document.getElementById('item-image-file').files[0];
    let imageBase64 = imageUrl;

    if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = function () {
            imageBase64 = reader.result;
            saveProduct(name, price, stock, category, desc, imageBase64);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveProduct(name, price, stock, category, desc, imageBase64);
    }
});

function saveProduct(name, price, stock, category, desc, imageBase64) {
    const product = { name, price, stock, category, desc, image: imageBase64 };

    const method = editingProductId ? 'PUT' : 'POST';
    const url = editingProductId ? `http://localhost:3000/api/items/${editingProductId}` : `http://localhost:3000/api/items`;

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    })
    .then(res => res.json())
    .then(data => {
        const productId = editingProductId || data.id;
        return fetch('http://localhost:3000/api/stock-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantityAdded: stock })
        });
    })
    .then(() => {
        loadProducts();
        toggleVisibility(false);
        clearForm();
    })
    .catch(error => console.error('Error saving product:', error));
}

document.getElementById('generate-tax-report').addEventListener('click', () => {
    fetch('http://localhost:3000/api/generate-income-tax-report')
        .then(res => res.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'income-tax-report.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => console.error('Error generating tax report:', error));
});

window.onload = loadProducts;
