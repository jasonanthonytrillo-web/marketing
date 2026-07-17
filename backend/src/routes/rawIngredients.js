const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// GET /api/inventory/ingredients
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const ingredients = await prisma.rawIngredient.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: ingredients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch raw ingredients.' });
  }
});

// POST /api/inventory/ingredients
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, stock, unit, costPrice, alertLevel } = req.body;
    if (!name || !unit) return res.status(400).json({ success: false, message: 'Name and unit are required.' });

    const ingredient = await prisma.rawIngredient.create({
      data: {
        tenantId: req.tenantId,
        name,
        stock: parseFloat(stock) || 0,
        unit,
        yield: req.body.yield ? parseFloat(req.body.yield) : 1,
        costPrice: parseFloat(costPrice) || 0,
        alertLevel: alertLevel ? parseFloat(alertLevel) : null
      }
    });
    res.json({ success: true, data: ingredient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to create raw ingredient.' });
  }
});

// PUT /api/inventory/ingredients/:id
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, stock, unit, costPrice, alertLevel } = req.body;
    
    // Check if stock changed to add log (simplified)
    const current = await prisma.rawIngredient.findUnique({ where: { id: parseInt(req.params.id) }});
    if (!current || current.tenantId !== req.tenantId) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    const updated = await prisma.rawIngredient.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        stock: parseFloat(stock) || 0,
        unit,
        yield: req.body.yield ? parseFloat(req.body.yield) : 1,
        costPrice: parseFloat(costPrice) || 0,
        alertLevel: alertLevel ? parseFloat(alertLevel) : null
      }
    });

    if (current.stock !== updated.stock) {
      await prisma.rawIngredientLog.create({
        data: {
          rawIngredientId: updated.id,
          quantityChange: updated.stock - current.stock,
          reason: 'adjustment',
          staffId: req.user.id
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update raw ingredient.' });
  }
});

// DELETE /api/inventory/ingredients/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const ingredient = await prisma.rawIngredient.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!ingredient || ingredient.tenantId !== req.tenantId) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    await prisma.rawIngredient.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Ingredient deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to delete raw ingredient.' });
  }
});

// GET /api/inventory/ingredients/recipes/:productId
router.get('/recipes/:productId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const recipes = await prisma.recipeItem.findMany({
      where: { productId: parseInt(req.params.productId) },
      include: { rawIngredient: true }
    });
    res.json({ success: true, data: recipes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch recipes.' });
  }
});

// POST /api/inventory/ingredients/recipes
router.post('/recipes', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { productId, rawIngredientId, quantityUsed } = req.body;
    if (!productId || !rawIngredientId || !quantityUsed) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Upsert to handle unique constraint (productId, rawIngredientId)
    const item = await prisma.recipeItem.upsert({
      where: {
        productId_rawIngredientId: {
          productId: parseInt(productId),
          rawIngredientId: parseInt(rawIngredientId)
        }
      },
      update: { quantityUsed: parseFloat(quantityUsed) },
      create: {
        productId: parseInt(productId),
        rawIngredientId: parseInt(rawIngredientId),
        quantityUsed: parseFloat(quantityUsed)
      }
    });

    res.json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to save recipe item.' });
  }
});

// DELETE /api/inventory/ingredients/recipes/:id
router.delete('/recipes/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await prisma.recipeItem.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Recipe item removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to delete recipe item.' });
  }
});

module.exports = router;
