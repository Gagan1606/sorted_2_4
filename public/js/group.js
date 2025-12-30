const API_BASE = '/api';

const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');

let currentGroup = null;

// Load group data
// Load group data
async function loadGroup() {
    // ADD LOADING OVERLAY
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10000;">
            <div style="text-align:center;">
                <div style="width:60px;height:60px;border:4px solid #27272a;border-top:4px solid #fafafa;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>
                <h2 style="color:#fafafa;margin-bottom:12px;font-size:20px;">Loading Photos...</h2>
                <p style="color:#a1a1aa;font-size:14px;max-width:300px;line-height:1.5;">This may take 10-30 seconds depending on album size. Please don't refresh.</p>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loadingOverlay);

    try {
        // GET CURRENT USER FIRST
        const currentUserResponse = await fetch(`${API_BASE}/current-user`, {
            credentials: 'include'
        });
        const currentUserData = await currentUserResponse.json();
        currentUser = currentUserData.user;

        // GET GROUP DATA
        const response = await fetch(`${API_BASE}/group/${groupId}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentGroup = data.group;
            document.getElementById('groupTitle').textContent = currentGroup.groupName;
            
            // Update loading message
            loadingOverlay.querySelector('p').textContent = 'Processing photos...';
            
            // Check if current user is the creator
            const isCreator = currentGroup.createdBy._id === currentUser._id;
            
            // CALL THE NEW displayMembers WITH isCreator PARAMETER
            displayMembers(currentGroup.members, isCreator);
            displayAllPhotos(data.allPhotos);
            displayUserPhotos(data.userPhotos);
            
            // Remove loading overlay after everything is loaded
            loadingOverlay.remove();
        } else {
            loadingOverlay.remove();
            alert('Group not found');
            window.location.href = 'home.html';
        }
    } catch (error) {
        console.error('Load group error:', error);
        loadingOverlay.remove();
        alert('Failed to load group. Please try again.');
    }
}

function displayMembers(members, isCreator) {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';
    
    members.forEach(member => {
        const tag = document.createElement('div');
        tag.className = 'member-tag';
        tag.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #27272a; border-radius: 6px; margin-bottom: 8px;';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = member.username;
        nameSpan.style.color = '#e4e4e7';
        tag.appendChild(nameSpan);
        
        // Show remove button only for creator and not for themselves
        if (isCreator && member._id !== currentUser._id) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold;';
            removeBtn.onclick = () => removeMemberFromGroup(groupId, member.username);
            tag.appendChild(removeBtn);
        } else if (member._id === currentUser._id && isCreator) {
            const badge = document.createElement('span');
            badge.textContent = 'Creator';
            badge.style.cssText = 'background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;';
            tag.appendChild(badge);
        }
        
        membersList.appendChild(tag);
    });
}
async function removeMemberFromGroup(groupId, username) {
    if (!confirm(`Remove ${username} from this group?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/remove-member-from-group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, username }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Member removed successfully');
            location.reload();
        } else {
            alert(data.error || 'Failed to remove member');
        }
    } catch (error) {
        console.error('Remove member error:', error);
        alert('Failed to remove member');
    }
}
function displayAllPhotos(photos) {
    const container = document.getElementById('allPhotosContainer');
    container.innerHTML = '<p style="color:#a1a1aa;text-align:center;padding:20px;">📸 Loading photos...</p>';

    // Small delay to let the message show
    setTimeout(() => {
        container.innerHTML = '';

        // Group by date
        const photosByDate = {};
        photos.forEach(photo => {
            const date = new Date(photo.capturedAt).toLocaleDateString();
            if (!photosByDate[date]) {
                photosByDate[date] = [];
            }
            photosByDate[date].push(photo);
        });

        // Display grouped photos
        Object.keys(photosByDate).sort().reverse().forEach(date => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';

            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.textContent = date;
            dateGroup.appendChild(dateHeader);

            const photoGrid = document.createElement('div');
            photoGrid.className = 'photo-grid';

            photosByDate[date].forEach(photo => {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';

                const img = document.createElement('img');
                img.src = `data:${photo.contentType};base64,${photo.photoData}`;

                // Add loading placeholder
                img.style.opacity = '0';
                img.onload = () => {
                    img.style.transition = 'opacity 0.3s';
                    img.style.opacity = '1';
                };

                const photoInfo = document.createElement('div');
                photoInfo.className = 'photo-info';

                const faces = photo.detectedFaces.map(f => f.username).join(', ');
                // photoInfo.innerHTML = `
                //     <div class="photo-faces">People: ${faces || 'None'}</div>
                // `;

                photoItem.appendChild(img);
                //photoItem.appendChild(photoInfo);
                photoGrid.appendChild(photoItem);
            });

            dateGroup.appendChild(photoGrid);
            container.appendChild(dateGroup);
        });
    }, 100);
}

function displayUserPhotos(photos) {
    const container = document.getElementById('yourPhotosContainer');
    container.innerHTML = '';

    if (photos.length === 0) {
        container.innerHTML = '<p>No photos of you in this group</p>';
        return;
    }

    const photoGrid = document.createElement('div');
    photoGrid.className = 'photo-grid';

    photos.forEach(photo => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';

        const img = document.createElement('img');
        img.src = `data:${photo.contentType};base64,${photo.photoData}`;

        photoItem.appendChild(img);
        photoGrid.appendChild(photoItem);
    });

    container.appendChild(photoGrid);
}

// Add Member Modal
const addMemberModal = document.getElementById('addMemberModal');

document.getElementById('addMemberBtn').addEventListener('click', () => {
    addMemberModal.style.display = 'block';
});

document.querySelector('.close').addEventListener('click', () => {
    addMemberModal.style.display = 'none';
});

// document.getElementById('confirmAddMember').addEventListener('click', async () => {
//     const username = document.getElementById('memberUsername').value;

//     if (!username) {
//         alert('Please enter a username');
//         return;
//     }

//     try {
//         const response = await fetch(`${API_BASE}/add-member-to-group`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ groupId, username }),
//             credentials: 'include'
//         });

//         const data = await response.json();

//         if (data.success) {
//             alert('Member added successfully');
//             addMemberModal.style.display = 'none';
//             loadGroup();
//         } else {
//             alert(data.error || 'Failed to add member');
//         }
//     } catch (error) {
//         console.error('Add member error:', error);
//         alert('Failed to add member');
//     }
// });

// Initialize
document.getElementById('confirmAddMember').addEventListener('click', async () => {
    const username = document.getElementById('memberUsername').value.trim();

    if (!username) {
        alert('Please enter a username');
        return;
    }

    try {
        // NEW: Send request instead of directly adding
        const response = await fetch(`${API_BASE}/send-member-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, username }),
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert(`Membership request sent to ${username}`);
            addMemberModal.style.display = 'none';
            document.getElementById('memberUsername').value = '';
        } else {
            alert(data.error || 'Failed to send request');
        }
    } catch (error) {
        console.error('Send request error:', error);
        alert('Failed to send request');
    }
});
loadGroup();