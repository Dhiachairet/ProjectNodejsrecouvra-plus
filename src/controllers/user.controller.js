import { User } from '../models/User.js';
import { sendJson, sendError } from '../utils/send.js';
import { validateUserUpdate } from '../utils/validation.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin/Manager
export async function getUsers(req, res, next) {
  try {
    // Build query
    const query = {};
    
    // Filter by role if provided
    if (req.query.role) {
      query.role = req.query.role;
    }
    
    // Filter by active status if provided
    if (req.query.active !== undefined) {
      query.active = req.query.active === 'true';
    }
    
    const users = await User.find(query).sort({ createdAt: -1 });
    
    sendJson(res, 200, {
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin/Manager
export async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    sendJson(res, 200, {
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export async function updateUser(req, res, next) {
  try {
    // Validate input
    const { error } = validateUserUpdate.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }
    
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    // Don't allow role change for self (security measure)
    if (req.user.id === req.params.id && req.body.role && req.body.role !== user.role) {
      return sendError(res, 400, 'You cannot change your own role');
    }
    
    // Don't allow deactivating self
    if (req.user.id === req.params.id && req.body.active === false) {
      return sendError(res, 400, 'You cannot deactivate your own account');
    }
    
    // Update user
    user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    sendJson(res, 200, {
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    // Don't allow self-deletion
    if (req.user.id === req.params.id) {
      return sendError(res, 400, 'You cannot delete your own account');
    }
    
    // Don't allow deleting last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return sendError(res, 400, 'Cannot delete the last admin user');
      }
    }
    
    await user.deleteOne();
    
    sendJson(res, 200, {
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}