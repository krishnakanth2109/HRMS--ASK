import Group from "../models/Group.js";

/* =====================================================
   CREATE GROUP
===================================================== */
export const createGroup = async (req, res) => {
  try {
    const {
      groupName,
      groupCode,
      description,
      groupLeader,
      permissions,
    } = req.body;

    if (!groupName || !groupCode || !groupLeader) {
      return res.status(400).json({
        message: "Group name, code and leader are required",
      });
    }

    const group = await Group.create({
      groupName,
      groupCode,
      description,
      groupLeader,
      permissions,
      createdBy: req.user._id, // ✅ FROM TOKEN (ADMIN)
    });

    res.status(201).json({
      message: "Group created successfully",
      data: group,
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({
      message: error.message || "Failed to create group",
    });
  }
};


/* =====================================================
   GET ALL GROUPS
===================================================== */
export const getAllGroups = async (req, res) => {
  try {
    const groups = await Group.find({ isDeleted: false })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation")
      .populate("createdBy", "adminName");

    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET SINGLE GROUP
===================================================== */
export const getSingleGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("groupLeader", "name employeeId")
      .populate("members.employee", "name employeeId");

    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE GROUP
===================================================== */
export const updateGroup = async (req, res) => {
  try {
    const updatedGroup = await Group.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({
      message: "Group updated successfully",
      updatedGroup,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   ASSIGN / CHANGE GROUP LEADER
===================================================== */
export const assignGroupLeader = async (req, res) => {
  try {
    const { leaderId } = req.body;

    if (!leaderId) {
      return res.status(400).json({ message: "Leader ID is required" });
    }

    const group = await Group.findById(req.params.id);
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.groupLeader = leaderId;
    await group.save();

    res.status(200).json({ message: "Group leader updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   ADD MEMBER TO GROUP
===================================================== */
export const addMember = async (req, res) => {
  try {
    const { employeeId, role } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const group = await Group.findById(req.params.id);
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    const exists = group.members.some(
      (m) => m.employee.toString() === employeeId
    );

    if (exists) {
      return res.status(400).json({ message: "Employee already in group" });
    }

    group.members.push({
      employee: employeeId,
      role: role || "member",
    });

    await group.save();

    res.status(200).json({ message: "Member added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   REMOVE MEMBER FROM GROUP
===================================================== */
export const removeMember = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const group = await Group.findById(req.params.id);
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.members = group.members.filter(
      (m) => m.employee.toString() !== employeeId
    );

    await group.save();

    res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   SOFT DELETE GROUP
===================================================== */
export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.isDeleted = true;
    group.status = "inactive";
    await group.save();

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};



/* =====================================================
   GET EMPLOYEE TEAMS (EMPLOYEE SIDE)
===================================================== */
export const getEmployeeTeams = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const teams = await Group.find({
      isDeleted: false,
      status: "active",
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation");

    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error("Get employee teams error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee teams",
    });
  }
};

/* =====================================================
   GET MY TEAMS (EMPLOYEE)
===================================================== */
export const getMyTeams = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const teams = await Group.find({
      isDeleted: false,
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation");

    res.status(200).json({
      data: teams,
    });
  } catch (error) {
    console.error("Get my teams error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET TEAM ATTENDANCE (EMPLOYEE SAFE)
===================================================== */
export const getTeamAttendanceToday = async (req, res) => {
  try {
    const employeeId = req.user._id;

    // Find employee teams
    const groups = await Group.find({
      isDeleted: false,
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    });

    const memberIds = [
      ...new Set(
        groups.flatMap((g) =>
          g.members.map((m) => m.employee.toString())
        )
      ),
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({
      employeeId: { $in: memberIds },
      date: today,
    });

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error("Team attendance error:", error);
    res.status(500).json({ message: "Failed to load attendance" });
  }
};


