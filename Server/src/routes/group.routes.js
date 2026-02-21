import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Helper to populate group with user details
const populateGroup = (query) => {
  return query
    .populate('leader', 'username avatar discordId discordAvatar statsHardcore.xp statsCdl.xp stats.xp platform irisLastSeen')
    .populate('members.user', 'username avatar discordId discordAvatar statsHardcore.xp statsCdl.xp stats.xp platform irisLastSeen')
    .populate('pendingInvites.user', 'username avatar discordId discordAvatar statsHardcore.xp statsCdl.xp stats.xp platform irisLastSeen')
    .populate('pendingInvites.invitedBy', 'username');
};

// Helper to emit group update to all members
const emitGroupUpdate = async (io, group) => {
  const populatedGroup = await populateGroup(Group.findById(group._id));
  
  // Emit to group room
  io.to(`group-${group._id}`).emit('groupUpdated', populatedGroup);
  
  // Also emit to each member's personal room
  for (const member of group.members) {
    io.to(`user-${member.user._id || member.user}`).emit('groupUpdated', populatedGroup);
  }
  
  return populatedGroup;
};

// Helper to format group for response
const formatGroupResponse = (group) => {
  if (!group) return null;
  return {
    _id: group._id,
    leader: group.leader,
    members: group.members,
    pendingInvites: group.pendingInvites,
    maxSize: group.maxSize,
    privacy: group.privacy,
    isInQueue: group.isInQueue,
    gameMode: group.gameMode,
    memberCount: group.members.length,
    isFull: group.members.length >= group.maxSize,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
};

// GET /api/groups/my - Get current user's group
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find group where user is a member
    let group = await populateGroup(Group.findOne({ 'members.user': userId }));
    
    if (!group) {
      // Create a new group with user as leader
      group = new Group({
        leader: userId,
        members: [{ user: userId, isReady: true }]
      });
      await group.save();
      group = await populateGroup(Group.findById(group._id));
    }
    
    res.json({ success: true, group: formatGroupResponse(group) });
  } catch (error) {
    console.error('Get my group error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/groups/pending-invites - Get pending invites for current user
router.get('/pending-invites', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find groups with pending invites for this user
    const groups = await populateGroup(
      Group.find({
        'pendingInvites.user': userId,
        'pendingInvites.expiresAt': { $gt: new Date() }
      })
    );
    
    const invites = groups.map(group => {
      const invite = group.pendingInvites.find(
        i => i.user._id.toString() === userId.toString()
      );
      return {
        groupId: group._id,
        leader: group.leader,
        members: group.members,
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt,
        expiresAt: invite.expiresAt
      };
    });
    
    res.json({ success: true, invites });
  } catch (error) {
    console.error('Get pending invites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/invite - Invite a player to the group
router.post('/invite', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user._id;
    const io = req.app.get('io');
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    // Find the user to invite
    const targetUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }
    
    if (targetUser._id.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot invite yourself' });
    }
    
    // Get or create the inviter's group
    let group = await Group.findOne({ 'members.user': userId });
    if (!group) {
      group = new Group({
        leader: userId,
        members: [{ user: userId, isReady: true }]
      });
      await group.save();
    }
    
    // Check if user is leader or if group allows member invites
    // For now, only leader can invite
    if (group.leader.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the leader can invite players' });
    }
    
    // Check if group is full
    if (group.members.length >= group.maxSize) {
      return res.status(400).json({ success: false, message: 'Group is full' });
    }
    
    // Check if target is already in this group
    if (group.hasMember(targetUser._id)) {
      return res.status(400).json({ success: false, message: 'Player is already in your group' });
    }
    
    // Check if target is already in another group
    const existingGroup = await Group.findOne({ 'members.user': targetUser._id });
    if (existingGroup && existingGroup.members.length > 1) {
      return res.status(400).json({ success: false, message: 'Player is already in another group' });
    }
    
    // Clean expired invites
    group.cleanExpiredInvites();
    
    // Check if already invited
    if (group.hasPendingInvite(targetUser._id)) {
      return res.status(400).json({ success: false, message: 'Player already has a pending invite' });
    }
    
    // Add the invite
    group.pendingInvites.push({
      user: targetUser._id,
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });
    
    await group.save();
    
    // Get populated group for response
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify the invited user
    const inviteData = {
      groupId: group._id,
      leader: populatedGroup.leader,
      members: populatedGroup.members,
      invitedBy: req.user.username,
      expiresAt: group.pendingInvites[group.pendingInvites.length - 1].expiresAt
    };
    io.to(`user-${targetUser._id}`).emit('groupInvite', inviteData);
    
    res.json({ success: true, message: 'Invite sent', group: formatGroupResponse(populatedGroup) });
  } catch (error) {
    console.error('Invite player error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/accept-invite - Accept a group invite
router.post('/accept-invite', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;
    const io = req.app.get('io');
    
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required' });
    }
    
    // Find the group with the invite
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    // Clean expired invites
    group.cleanExpiredInvites();
    
    // Check if user has a valid invite
    const inviteIndex = group.pendingInvites.findIndex(
      i => i.user.toString() === userId.toString()
    );
    
    if (inviteIndex === -1) {
      return res.status(400).json({ success: false, message: 'No valid invite found' });
    }
    
    // Check if group is full
    if (group.members.length >= group.maxSize) {
      return res.status(400).json({ success: false, message: 'Group is full' });
    }
    
    // Leave current group if in one
    const currentGroup = await Group.findOne({ 'members.user': userId });
    if (currentGroup && currentGroup._id.toString() !== groupId) {
      // Remove from current group
      currentGroup.members = currentGroup.members.filter(
        m => m.user.toString() !== userId.toString()
      );
      
      if (currentGroup.members.length === 0) {
        // Delete empty group
        await Group.deleteOne({ _id: currentGroup._id });
      } else if (currentGroup.leader.toString() === userId.toString()) {
        // Transfer leadership to first remaining member
        currentGroup.leader = currentGroup.members[0].user;
        await currentGroup.save();
        await emitGroupUpdate(io, currentGroup);
      } else {
        await currentGroup.save();
        await emitGroupUpdate(io, currentGroup);
      }
      
      // Notify old group members
      io.to(`group-${currentGroup._id}`).emit('memberLeft', { userId, username: req.user.username });
    }
    
    // Remove the invite and add as member
    group.pendingInvites.splice(inviteIndex, 1);
    group.members.push({ user: userId, isReady: true });
    
    await group.save();
    
    // Emit updates
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify group members
    io.to(`group-${group._id}`).emit('memberJoined', {
      userId,
      username: req.user.username,
      group: formatGroupResponse(populatedGroup)
    });
    
    res.json({ success: true, message: 'Joined group', group: formatGroupResponse(populatedGroup) });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/decline-invite - Decline a group invite
router.post('/decline-invite', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user._id;
    const io = req.app.get('io');
    
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required' });
    }
    
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    // Remove the invite
    const inviteIndex = group.pendingInvites.findIndex(
      i => i.user.toString() === userId.toString()
    );
    
    if (inviteIndex === -1) {
      return res.status(400).json({ success: false, message: 'No invite found' });
    }
    
    group.pendingInvites.splice(inviteIndex, 1);
    await group.save();
    
    // Notify the group leader
    io.to(`user-${group.leader}`).emit('inviteDeclined', {
      userId,
      username: req.user.username
    });
    
    res.json({ success: true, message: 'Invite declined' });
  } catch (error) {
    console.error('Decline invite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/kick - Kick a player from the group (leader only)
router.post('/kick', verifyToken, async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const leaderId = req.user._id;
    const io = req.app.get('io');
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    // Find the group
    const group = await Group.findOne({ leader: leaderId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'You are not a group leader' });
    }
    
    // Can't kick yourself
    if (targetUserId === leaderId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot kick yourself. Use leave instead.' });
    }
    
    // Check if target is in the group
    const memberIndex = group.members.findIndex(
      m => m.user.toString() === targetUserId
    );
    
    if (memberIndex === -1) {
      return res.status(400).json({ success: false, message: 'Player is not in your group' });
    }
    
    // Get the kicked user's info before removing
    const kickedUser = await User.findById(targetUserId, 'username');
    
    // Remove the member
    group.members.splice(memberIndex, 1);
    await group.save();
    
    // Emit updates to all remaining members
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify the kicked user
    io.to(`user-${targetUserId}`).emit('kickedFromGroup', {
      groupId: group._id,
      kickedBy: req.user.username
    });
    
    // Create a new solo group for the kicked user
    const newGroup = new Group({
      leader: targetUserId,
      members: [{ user: targetUserId, isReady: true }]
    });
    await newGroup.save();
    const newPopulatedGroup = await populateGroup(Group.findById(newGroup._id));
    io.to(`user-${targetUserId}`).emit('groupUpdated', newPopulatedGroup);
    
    res.json({ 
      success: true, 
      message: `${kickedUser?.username || 'Player'} has been kicked`,
      group: formatGroupResponse(populatedGroup)
    });
  } catch (error) {
    console.error('Kick player error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/leave - Leave the current group
router.post('/leave', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const io = req.app.get('io');
    
    // Find user's group
    const group = await Group.findOne({ 'members.user': userId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'You are not in a group' });
    }
    
    // If only one member (the user), just keep them in their solo group
    if (group.members.length === 1) {
      return res.status(400).json({ success: false, message: 'You are already alone in your group' });
    }
    
    // Leader cannot leave without transferring leadership first
    if (group.leader.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: 'You must transfer leadership before leaving the group' });
    }
    
    // Remove user from group
    group.members = group.members.filter(m => m.user.toString() !== userId.toString());
    
    await group.save();
    
    // Emit updates to remaining members
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify remaining members
    io.to(`group-${group._id}`).emit('memberLeft', {
      userId,
      username: req.user.username
    });
    
    // Create a new solo group for the user who left
    const newGroup = new Group({
      leader: userId,
      members: [{ user: userId, isReady: true }]
    });
    await newGroup.save();
    const newPopulatedGroup = await populateGroup(Group.findById(newGroup._id));
    
    res.json({ success: true, message: 'Left group', group: formatGroupResponse(newPopulatedGroup) });
    
    // Send the new group to the user
    io.to(`user-${userId}`).emit('groupUpdated', newPopulatedGroup);
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/toggle-ready - Toggle ready status
router.post('/toggle-ready', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const io = req.app.get('io');
    
    const group = await Group.findOne({ 'members.user': userId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'You are not in a group' });
    }
    
    // Find and toggle the member's ready status
    const member = group.members.find(m => m.user.toString() === userId.toString());
    if (member) {
      member.isReady = !member.isReady;
      await group.save();
    }
    
    const populatedGroup = await emitGroupUpdate(io, group);
    
    res.json({ success: true, group: formatGroupResponse(populatedGroup) });
  } catch (error) {
    console.error('Toggle ready error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/transfer-leader - Transfer leadership to another member
router.post('/transfer-leader', verifyToken, async (req, res) => {
  try {
    const { userId: newLeaderId } = req.body;
    const currentLeaderId = req.user._id;
    const io = req.app.get('io');
    
    if (!newLeaderId) {
      return res.status(400).json({ success: false, message: 'New leader ID is required' });
    }
    
    const group = await Group.findOne({ leader: currentLeaderId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'You are not a group leader' });
    }
    
    // Check if new leader is in the group
    if (!group.hasMember(newLeaderId)) {
      return res.status(400).json({ success: false, message: 'Player is not in your group' });
    }
    
    // Transfer leadership
    group.leader = newLeaderId;
    await group.save();
    
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify all members
    io.to(`group-${group._id}`).emit('leaderChanged', {
      oldLeader: currentLeaderId,
      newLeader: newLeaderId,
      group: formatGroupResponse(populatedGroup)
    });
    
    res.json({ success: true, message: 'Leadership transferred', group: formatGroupResponse(populatedGroup) });
  } catch (error) {
    console.error('Transfer leader error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/groups/search-players - Search for players to invite
router.get('/search-players', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user._id;
    
    if (!query || query.length < 2) {
      return res.json({ success: true, players: [] });
    }
    
    // Search for users by username
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: userId },
      isBanned: { $ne: true }
    })
    .select('username avatar discordId discordAvatar statsHardcore.xp statsCdl.xp stats.xp platform irisLastSeen')
    .limit(10);
    
    // Get user's current group to filter out existing members
    const group = await Group.findOne({ 'members.user': userId });
    const memberIds = group ? group.members.map(m => m.user.toString()) : [];
    const pendingIds = group ? group.pendingInvites.map(i => i.user.toString()) : [];
    
    const players = users.map(user => {
      // Calculate level from XP (same formula as Client V1)
      const totalXP = (user.statsHardcore?.xp || 0) + (user.statsCdl?.xp || 0) + (user.stats?.xp || 0);
      const level = Math.floor(totalXP / 1000) + 1;
      
      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        discordId: user.discordId,
        discordAvatar: user.discordAvatar,
        level,
        platform: user.platform,
        irisLastSeen: user.irisLastSeen,
        irisConnected: user.irisLastSeen && (Date.now() - new Date(user.irisLastSeen).getTime()) < 2 * 60 * 1000, // Connected if seen in last 2 minutes
        isInGroup: memberIds.includes(user._id.toString()),
        hasPendingInvite: pendingIds.includes(user._id.toString())
      };
    });
    
    res.json({ success: true, players });
  } catch (error) {
    console.error('Search players error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groups/cancel-invite - Cancel a pending invite
router.post('/cancel-invite', verifyToken, async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const leaderId = req.user._id;
    const io = req.app.get('io');
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    const group = await Group.findOne({ leader: leaderId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'You are not a group leader' });
    }
    
    const inviteIndex = group.pendingInvites.findIndex(
      i => i.user.toString() === targetUserId
    );
    
    if (inviteIndex === -1) {
      return res.status(400).json({ success: false, message: 'No pending invite found' });
    }
    
    group.pendingInvites.splice(inviteIndex, 1);
    await group.save();
    
    const populatedGroup = await emitGroupUpdate(io, group);
    
    // Notify the target user
    io.to(`user-${targetUserId}`).emit('inviteCancelled', { groupId: group._id });
    
    res.json({ success: true, message: 'Invite cancelled', group: formatGroupResponse(populatedGroup) });
  } catch (error) {
    console.error('Cancel invite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
