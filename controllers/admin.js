const Product = require('../models/product');
const fileHelper = require('../util/file');
const {validationResult} = require('express-validator/check');
// const mongodb = require('mongodb');
exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: []
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  const errors = validationResult(req);
  console.log(image);
  if(!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/Edit-product',
      editing: false,
      hasError: true,
      errorMessage: 'Attached file is not an image.',
      product: {
        title: title,
        price: price,
        description: description
      },
      validationErrors: []
    }); 
  }
  if(!errors.isEmpty()) {
    console.log(errors.array())
   return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/Edit-product',
      editing: false,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      product: {
        title: title,
        price: price,
        description: description
      },
      validationErrors: errors.array()
    }); 
  }

  const imageUrl = image.path;

  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    userId: req.user
  });
  product.save()
  .then(results => {
    console.log(results);
    res.redirect('/admin/products');
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if(!editMode) {
    redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
  .then(product => {
    if(!product) {
      return res.redirect('/');
    }
    res.render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/Edit-product',
      editing: editMode,
      product: product,
      hasError: false,
      errorMessage: null,
      validationErrors: []
    });
  }).catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};
exports.postEditProduct = (req, res, next) => {
  const updatedTitle = req.body.title;
  const image = req.file;
  const updatedPrice = req.body.price;
  const updatedDescription = req.body.description;
  const prodId = req.body.productId;
  const errors = validationResult(req);

  if(!errors.isEmpty()) {
    console.log(errors.array())
   return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/Edit-product',
      editing: true,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDescription,
        _id: prodId
      },
      validationErrors : errors.array()
    }); 
  }
  Product.findById(prodId)
  .then(product => {
    console.log(product)
    product.title = updatedTitle;
    product.price = updatedPrice;
    product.description = updatedDescription;
    if(image) {
      fileHelper.deleteFile(product.imageUrl);
      product.imageUrl = image.path;
    }
    return product.save()
  })
  .then(product => {
    console.log('UPDATED PRODUCT!');
    res.redirect('/admin/products');
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
  .then(product => {
    if(!product) {
      return next(new Error('Product not found'));
    }
    fileHelper.deleteFile(product.imageUrl);
    return Product.deleteOne({_id: prodId, userId: req.user._id});
  })
  .then(() => {
    console.log('DELETED PRODUCT!');
    res.status(200).json({message: 'Success!'});
  })
  .catch(err => {
    res.status(500).json({message: 'Deleting product failed.'})
  });
};
exports.getProducts = (req, res, next) => {
  Product.find({userId: req.user._id})
  // .select('title price -_id')
  // .populate('userId','name')
  .then(products => {
    console.log(products);
    res.render('admin/products', {
      prods: products,
      pageTitle: 'Admin Products',
      path: '/admin/products',
    });
  }).catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};
