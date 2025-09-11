const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let productsCollection;

const setCollection = (db) => {
    productsCollection = db.collection("products")
}

// all products get
router.get("/", async(req, res) => {
    try {
        const products = await productsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        })
    } catch (err) {
        console.error("Error fetching products:", err)
        res.status(500).json({
            success: false,
            message: "Internal Server error"
        })
    }
})

// get single products
router.get("/:id", async(req, res) => {
    const {id} = req.params;
    if(!ObjectId.isValid(id)){
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        })
    }

    try {
        const productsItem = await productsCollection.findOne({
            _id: new ObjectId(id),
        });

        if(!productsItem){
            return res.status(404).json({
                success: false,
                message: "Products item not found",
            });
        }

        res.status(200).json({
            success: true,
            data: productsItem,
        })
    } catch (error) {
        console.error("Error fetching products item:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server error",
        })
    }
})


// post a new product item
router.post("/", async(req, res) => {
    const newProduct = req.body;

    try{
        const result = await productsCollection.insertOne(newProduct);
        res.status(201).json({
            success: true,
            message: "product item added successfully",
            data: {_id: result.insertedId, ...newProduct},

        })
    } catch (error) {
        console.error("Error adding product item:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
});

// put (update) a product item by id
router.put("/:id", async(req, res) => {
    const {id} = req.params;
    const updatedProducts = req.body;

    if(!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        })
    }

    try {
        const result = await productsCollection.updateOne(
            {_id: new ObjectId(id)},
            {$set: updatedProducts}
        );

        if (result.matchedCount === 0){
            return res.status(404).json({
                success: false,
                message: "Products item not found",
            });
        }

        const updateDoc = await productsCollection.findOne({
            _id: new ObjectId(id),
        })

        res.status(200).json({
            success: true,
            message: "Product item updated Successfully",
            data: updateDoc,
        })
    } catch(error) {
        console.error("Error updating products item:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
        })
    }
})


// delete a product by id
router.delete("/:id", async(req, res) => {
    const {id} = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }
  try {
    const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
    })

    if(result.deletedCount === 0) {
        return res.status(404).json({
            success: false,
            messgae: "Products item not found",
        })
    }

    res.status(200).json({
        success: true,
        messgae: "Products item deleted successfully",
    })

  } catch (error) {
    console.error("Error deleting products item", error)
    res.status(500).json({
        success: false,
        messgae: "Internal server error",
    })
  }
})

module.exports = {router, setCollection}