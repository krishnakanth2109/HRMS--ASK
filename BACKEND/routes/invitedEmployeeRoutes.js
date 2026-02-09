import express from 'express';
import InvitedEmployee from '../models/Invitedemployee.js'; // Adjust path as needed
import Company from '../models/CompanyModel.js'; // Adjust path as needed

const router = express.Router();

// --- INVITE SINGLE EMPLOYEE ---
router.post('/invite', async (req, res) => {
  try {
    const { email, companyId, invitedBy, name, role, department, employmentType, salary } = req.body;

    if (!email || !companyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and Company ID are required' 
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      });
    }

    // Check if email already invited
    const existingInvite = await InvitedEmployee.findOne({ email: email.toLowerCase() });
    
    if (existingInvite) {
      // Update existing invite (handles re-inviting revoked users or updating details)
      if (existingInvite.status === 'revoked' || existingInvite.status === 'pending') {
        existingInvite.company = companyId;
        existingInvite.status = 'pending';
        existingInvite.name = name || existingInvite.name;
        existingInvite.role = role || existingInvite.role;
        existingInvite.department = department || existingInvite.department;
        existingInvite.employmentType = employmentType || existingInvite.employmentType; // Added
        existingInvite.salary = salary || existingInvite.salary; // Added
        existingInvite.invitedAt = new Date();
        if (invitedBy) existingInvite.invitedBy = invitedBy;
        
        await existingInvite.save();
        
        return res.status(200).json({ 
          success: true, 
          message: 'Invitation updated successfully',
          data: existingInvite 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already invited or onboarded' 
        });
      }
    }

    // Create new invitation
    const newInvite = new InvitedEmployee({
      email: email.toLowerCase(),
      company: companyId,
      invitedBy: invitedBy || null,
      name,
      role,
      department,
      employmentType, // Added
      salary,        // Added
      status: 'pending'
    });

    await newInvite.save();

    res.status(201).json({ 
      success: true, 
      message: 'Email invited successfully',
      data: newInvite 
    });

  } catch (error) {
    console.error('Error inviting employee:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to invite employee' 
    });
  }
});

// --- BULK INVITE EMPLOYEES ---
router.post('/invite-bulk', async (req, res) => {
  try {
    const { employees, companyId, invitedBy } = req.body; 

    if (!employees || !Array.isArray(employees) || employees.length === 0 || !companyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid employee array and Company ID are required' 
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const results = { success: [], failed: [], alreadyInvited: [] };

    for (let emp of employees) {
      const emailLower = emp.email ? emp.email.toLowerCase().trim() : null;
      
      if (!emailLower || !emailLower.includes('@')) {
        results.failed.push({ email: emp.email, reason: 'Invalid email format' });
        continue;
      }

      try {
        const existingInvite = await InvitedEmployee.findOne({ email: emailLower });
        
        if (existingInvite) {
          if (existingInvite.status === 'revoked' || existingInvite.status === 'pending') {
            existingInvite.company = companyId;
            existingInvite.status = 'pending';
            existingInvite.name = emp.name;
            existingInvite.role = emp.role;
            existingInvite.department = emp.department;
            existingInvite.employmentType = emp.employmentType; // Added
            existingInvite.salary = emp.salary;                 // Added
            existingInvite.invitedAt = new Date();
            if (invitedBy) existingInvite.invitedBy = invitedBy;
            await existingInvite.save();
            results.success.push(emailLower);
          } else {
            results.alreadyInvited.push(emailLower);
          }
        } else {
          await InvitedEmployee.create({
            ...emp,
            email: emailLower,
            company: companyId,
            invitedBy,
            status: 'pending'
          });
          results.success.push(emailLower);
        }
      } catch (err) {
        results.failed.push({ email: emailLower, reason: err.message });
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Processed ${employees.length} invitations`,
      results 
    });

  } catch (error) {
    console.error('Error in bulk invite:', error);
    res.status(500).json({ success: false, error: 'Failed to process bulk invite' });
  }
});


router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOne({ 
      email: email.toLowerCase()
    }).populate('company', 'name _id prefix');

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Email not found in invitation list' });
    }

    // Check if already onboarded
    if (invite.status === 'onboarded') {
      return res.status(400).json({ 
        success: false, 
        onboarded: true,
        message: `Your email is already onboarded for ${invite.name || 'user'} in ${invite.company?.name || 'the company'}`,
        data: invite
      });
    }

    if (invite.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'Your invitation has been revoked.' });
    }

    res.status(200).json({ 
      success: true, 
      data: {
        email: invite.email,
        company: invite.company,
        name: invite.name,
        role: invite.role,
        department: invite.department,
        employmentType: invite.employmentType, // Added
        salary: invite.salary,                 // Added
        invitedAt: invite.invitedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});


router.post('/mark-onboarded', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOneAndUpdate(
      { email: email.toLowerCase(), status: 'pending' },
      { status: 'onboarded', onboardedAt: new Date() },
      { new: true }
    );

    if (!invite) return res.status(404).json({ success: false, error: 'Invitation not found' });

    res.status(200).json({ success: true, message: 'Email marked as onboarded', data: invite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});


router.post('/revoke', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOneAndUpdate(
      { email: email.toLowerCase() },
      { status: 'revoked' },
      { new: true }
    );

    if (!invite) return res.status(404).json({ success: false, error: 'Invitation not found' });

    res.status(200).json({ success: true, message: 'Invitation revoked successfully', data: invite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to revoke invitation' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await InvitedEmployee.find()
      .populate('company', 'name')
      .sort({ invitedAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});


router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const invitations = await InvitedEmployee.find({ company: companyId })
      .populate('company', 'name')
      .sort({ invitedAt: -1 });

    res.status(200).json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invitations' });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await InvitedEmployee.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Invitation deleted permanently from database' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete record' });
  }
});

export default router;