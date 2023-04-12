const Product = require('../models/product');
const Order = require('../models/order');
const user = require('../models/user');
const fs = require('fs');
const path = require('path');
const order = require('../models/order');
const stripe = require('stripe')('sk_test_51Jv4acGtik5Ujq1lvaBNczqFOC0NL0mnmKxLva683MxPICcAUZPAvrEtOpEEFJe9JXw8BKcAFmloIntemLLlHR7100y9x5KgDx');
const ITEMS_PER_PAGE = 1;

const PDFDocument = require('pdfkit');

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find().countDocuments()
  .then(numProducts => {
    totalItems = numProducts;
    return Product.find()
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE) 
  })
  .then(products => {
    res.render('shop/product-list', {
      prods: products,
      pageTitle: 'Products',
      path: '/products',
      currentPage: page,
      hasNextPage: page * ITEMS_PER_PAGE < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
  .then(
    product => {
    res.render('shop/product-detail', {
      product: product,
      pageTitle: product.title,
      path:'/products',
    });
  }).catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find().countDocuments()
  .then(numProducts => {
    totalItems = numProducts;
    return Product.find()
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE) 
  })
  .then(products => {
    res.render('shop/index', {
      prods: products,
      pageTitle: 'Shop',
      path: '/',
      currentPage: page,
      hasNextPage: page * ITEMS_PER_PAGE < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCart = (req, res, next) => {
  req.user
  .populate('cart.items.productId')
  .then(user => {
    const products = user.cart.items;
    res.render('shop/cart', {
      path: '/cart',
      pageTitle: 'Your Cart',
      products: products,
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });

};
  // Cart.getCart(cart => {
  //   Product.fetchAll().then(([rows, fieldData]) => {
  //     const cartProducts = [];
  //     for(cartProduct of cart.products) {
  //       const cartProd = rows.find(prod => prod.id === cartProduct.id);
  //       if(cartProd){
  //         cartProducts.push({productData: cartProd, qty: cartProduct.qty});
  //       }
  //     }
  //   })
  //   });


exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
  .then(product => {
    return req.user.addToCart(product);
  })
  .then(result => {
    res.redirect('/cart');
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
  // let newQuantity = 1;
  // let fetchedCart;
  // req.user.getCart()
  // .then(cart => {
  //   fetchedCart = cart;
  //   return cart.getProducts({where: {id: prodId}});
  // })
  // .then(products => {
  //   let product;
  //   if(products.length > 0) {
  //     product = products[0];
  //   }
  //   if(product) {
  //     const oldQuantity = product.cartItem.quantity;
  //     newQuantity = oldQuantity + 1;
  //     return product;
  //   }
  //   return Product.findByPk(prodId);
  // })
  // .then( product => {
  //     return fetchedCart.addProduct(product, 
  //       {through: {quantity: newQuantity}});      
  //   })
  // .then(() => {
  // })
  // .catch(err => console.log(err));
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user.removeFromCart(prodId)
  .then(result => {
    res.redirect('/cart');
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
  .populate('cart.items.productId')
  .then(user => {
    products = user.cart.items;
    total = 0;
    products.forEach(p => {
      total += p.quantity * p.productId.price;
    })
    return stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: products.map(p => {
        return {
          name: p.productId.title,
          description: p.productId.description,
          amount: p.productId.price * 100,
          currency: 'usd', 
          quantity: p.quantity
        }
      }),
      success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
      cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
    });
  })
  .then(session => {
    res.render('shop/checkout', {
      path: '/checkout',
      pageTitle: 'Checkout',
      products: products,
      totalSum: total,
      sessionId: session.id
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
  .populate('cart.items.productId')
  .then(user => {
    const products = user.cart.items.map(i => {
      return { product: {...i.productId._doc}, quantity: i.quantity};
    });
    console.log(products);
    const order = new Order({
      products: products,
      user: {
        email: req.user.email,
        userId: req.user
      }
    });
    order.save();
  })
  .then(result => {
    return req.user.clearCart();
  })
  .then(() => {
    res.redirect('/orders');
  }) 
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getOrders = (req, res, next) => {
  Order.find({'user.userId': req.user._id})
  .then(orders => {
    res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders',
      orders: orders
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  order.findById(orderId)
  .then(order => {
    if(!order) {
      return next(new Error('No order Found.'));
    }
    if(order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error('Unauthorized'));      
    }
    const invoiceName = 'invoice-' + orderId + '.pdf';
    const invoicePath = path.join('data', 'invoices', invoiceName);
    const pdfDoc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
    pdfDoc.pipe(fs.createWriteStream(invoicePath));
    pdfDoc.pipe(res);

    pdfDoc.fontSize(26).text('Invoice', {
      underline: true
    });
    pdfDoc.text('--------------------');
    let totalPrice = 0;
    order.products.forEach(prod => {

      totalPrice += prod.quantity * prod.product.price;
      pdfDoc.fontSize(14).text(prod.product.title + ' - ' + prod.quantity + ' x ' + ' $ ' + prod.product.price);

    });
    pdfDoc.text('-----');
    pdfDoc.fontSize(20).text('Total price: $' + totalPrice);

    pdfDoc.end();

    // fs.readFile(invoicePath, (err, data) => {
    //   if(err) {
    //     return next(err);
    //   }
    //   res.setHeader('Content-Type', 'application/pdf');
    //   res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
    //   res.send(data);
    // });

  })
  .catch(err => {
    next(err);
  }) 
}; 

