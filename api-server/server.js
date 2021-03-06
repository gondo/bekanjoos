var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var http = require('http');
var AWS = require('aws-sdk');
var s3Writer = require('./s3.js');
var db = require('./db.js');
var numeral = require('numeraljs');

var port = process.env.PORT || 9000;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// middleware to use for all requests
router.use(function(req, res, next) {
    // do logging
    next(); // make sure we go to the next routes and don't stop here
});

function parseCurrency(priceText) {
    var i;
    var price = priceText.trim();
    for (i = 0; i < price.length; i++) {
        if (parseInt(price[i]) >= 0 && parseInt(price[i]) <= 9) {
            break;
        }
    }
    var priceNumber = price.substr(i, price.length).trim(),
        currency = price.substr(0, i).trim();

    return {
        currency: currency,
        price: numeral().unformat(priceNumber)
    }
}

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.route('/')
.get(function(req, res) {
      res.send({'status': "All systems go!"});
});

// client routes
// add a new user with FB ID, or check existing user
router.route('/register')
  .post(function(req, res) {
      var fbid = req.body.fbid;
      var email = req.body.email;
      db.registerUser(fbid, email);
      res.send({ 'success': true, 'id': fbid });
  })

router.route('/user/:fbid/products')
  // get all products that the user is tracking
  .get(function(req, res) {
    var fbid = req.params.fbid;
    db.findUserProducts(fbid, function(allProducts) {
      res.send({'products': allProducts});
    });
  })

router.route('/user/:fbid/product')
  // when a user wants to track a new product
  .post(function(req, res) {
    var fbid = req.params.fbid;
    var title = req.body.title;
    var url = req.body.url;
    var site = req.body.site;
    var currency = parseCurrency(req.body.price)["currency"]
    var price = parseCurrency(req.body.price)["price"]
    var product_id = req.body.product_id;

    // TODO: remove
    console.log(req.body);

    db.doesProductExist(site, product_id, function(productExists) {
      if (!productExists) {
        var image_url = req.body.image_url;
        s3Writer.storeInS3(image_url, site, product_id, function(s3publicUrl) {
          db.addProduct(site, product_id,
                  title, s3publicUrl, price, currency, url, function(productAdded) {
            if (productAdded) {
              db.registerUserProduct(fbid, site, product_id, function(dbResponse) {
                if (dbResponse == 'exists')
                  // can set status numbers to condition on based on client side requirements
                  res.json({message: "You're already tracking this product"});
                if (dbResponse == 'added')
                  res.json({message: "You are now tracking this product"});
              });
            }
          });
        });
      }
      else {
        db.registerUserProduct(fbid, site, product_id, function(dbResponse) {
          if (dbResponse == 'exists')
            // can set status numbers to condition on based on client side requirements
            res.json({message: "You're already tracking this product"});
          if (dbResponse == 'added')
            res.json({message: "You are now tracking this product"});
        });
      }
    });
  })

  // user wants to delete a product from his list
  .delete(function(req, res) {
    var fbid = req.params.fbid;
    var site = req.body.site;
    var product_id = req.body.product_id;
    db.unTrackProduct(fbid, site, product_id, function(productDeleted) {
      if (productDeleted) {
        res.json({message: "Product Removed"});
      }
    });

  });

// crawler routes
router.route('/crawl/newprice')
// check if crawled price is less than current price
  .post(function(req, res) {
    var site = req.body.site;
    var product_id = req.body.product_id;
    var newPrice = req.body.new_price;
    db.updateProductPrice(site, product_id, newPrice);
    });

// get info of all products to call
router.route('/crawl/allproducts')
.get(function (req, res) {
    db.findProductUrls(function (products) {
        db.getUserProducts(function(userProductMapping) {
            var mapping = userProductMapping.map(function(p) {
                return {
                    userid: p.fbid,
                    email: p.email,
                    productids: p.trackedProducts.split(",")
                }
            });
            res.json({
                'products': products, 
                'mapping': mapping 
            });
        });
    });
})





// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Listening on 9000');
