const API_BASE = '/api';
// PWA Install Prompt
let deferredPrompt;

// window.addEventListener('beforeinstallprompt', (e) => {
//     e.preventDefault();
//     deferredPrompt = e;

//     // Show custom install button
//     const installDiv = document.createElement('div');
//     installDiv.id = 'installPrompt';
//     installDiv.innerHTML = `
//             <div style="background:#18181b;border-top:1px solid #27272a;color:#e4e4e7;padding:16px;text-align:center;position:fixed;bottom:0;left:0;right:0;z-index:9999;box-shadow:0 -2px 10px rgba(0,0,0,0.4);">
//   <p style="margin:0 0 12px 0;font-weight:600;color:#fafafa;">Install Photo Share App</p>
//   <button onclick="installPWA()" style="background:#fafafa;color:#18181b;border:none;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;margin-right:10px;">Install</button>
//   <button onclick="dismissInstall()" style="background:transparent;color:#e4e4e7;border:1px solid #3f3f46;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;">Not Now</button>
// </div>
//     `;
//     document.body.appendChild(installDiv);
// });
// REPLACE the existing beforeinstallprompt listener with this:


window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button with BLACK & WHITE theme
    const installDiv = document.createElement('div');
    installDiv.id = 'installPrompt';
    installDiv.innerHTML = `
        <div style="background:#18181b;border-top:1px solid #27272a;color:#e4e4e7;padding:16px;text-align:center;position:fixed;bottom:0;left:0;right:0;z-index:9999;box-shadow:0 -2px 10px rgba(0,0,0,0.4);">
            <p style="margin:0 0 12px 0;font-weight:600;color:#fafafa;">Install Sorted App</p>
            <button onclick="installPWA()" style="background:#fafafa;color:#18181b;border:none;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;margin-right:10px;transition:background 0.2s;">Install</button>
            <button onclick="dismissInstall()" style="background:transparent;color:#e4e4e7;border:1px solid #3f3f46;padding:10px 20px;border-radius:10px;font-weight:600;cursor:pointer;transition:all 0.2s;">Not Now</button>
        </div>
    `;
    document.body.appendChild(installDiv);

    // Add hover effects
    const buttons = installDiv.querySelectorAll('button');
    buttons[0].addEventListener('mouseenter', () => {
        buttons[0].style.background = '#e4e4e7';
    });
    buttons[0].addEventListener('mouseleave', () => {
        buttons[0].style.background = '#fafafa';
    });
    buttons[1].addEventListener('mouseenter', () => {
        buttons[1].style.borderColor = '#52525b';
    });
    buttons[1].addEventListener('mouseleave', () => {
        buttons[1].style.borderColor = '#3f3f46';
    });
});

window.installPWA = async function () {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('installPrompt').remove();
    }
};

window.dismissInstall = function () {
    document.getElementById('installPrompt').remove();
};

let currentUser = null;
let detectedUsersData = [];
let pendingGroupData = null;
let selectedFolder = null;
// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/current-user`, {
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = 'index.html';
            return;
        }

        const data = await response.json();
        currentUser = data.user;
        document.getElementById('username-display').textContent = currentUser.username;
        showFeedbackFormIfNeeded();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

function showFeedbackFormIfNeeded() {
    const hasSeenFeedback = localStorage.getItem('feedbackShown');

    if (!hasSeenFeedback) {
        setTimeout(() => {
            const modal = document.createElement('div');
            modal.id = 'feedbackModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;';

            modal.innerHTML = `
                <div style="background:#18181b;padding:32px;border-radius:16px;max-width:500px;width:90%;border:1px solid #27272a;">
                    <h2 style="color:#fafafa;margin-bottom:24px;font-size:20px;">Help Us Improve Sorted! 🎉</h2>
                    
                    <div style="margin-bottom:20px;">
                        <label style="color:#a1a1aa;display:block;margin-bottom:12px;font-weight:500;">What feature are you most excited about?</label>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <label style="color:#e4e4e7;cursor:pointer;padding:10px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;">
                                <input type="radio" name="feature" value="instant_share" style="margin-right:10px;">
                                Instant Share
                            </label>
                            <label style="color:#e4e4e7;cursor:pointer;padding:10px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;">
                                <input type="radio" name="feature" value="auto_selection" style="margin-right:10px;">
                                Auto Selection
                            </label>
                            <label style="color:#e4e4e7;cursor:pointer;padding:10px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;">
                                <input type="radio" name="feature" value="auto_group" style="margin-right:10px;">
                                Auto Group Creation
                            </label>
                            <label style="color:#e4e4e7;cursor:pointer;padding:10px;border:1px solid #3f3f46;border-radius:8px;display:flex;align-items:center;">
                                <input type="radio" name="feature" value="shared_album" style="margin-right:10px;">
                                Shared Album Creation
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom:24px;">
                        <label style="color:#a1a1aa;display:block;margin-bottom:8px;font-weight:500;">How did you hear about Sorted?</label>
                        <input type="text" id="feedbackSource" style="width:100%;padding:12px;border:1px solid #3f3f46;border-radius:8px;background:#27272a;color:#fafafa;" placeholder="Tell us...">
                    </div>
                    
                    <div style="display:flex;gap:12px;">
                        <button id="submitFeedback" style="flex:1;padding:12px;background:#fafafa;color:#18181b;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Submit</button>
                        <button id="skipFeedback" style="padding:12px 20px;background:transparent;color:#e4e4e7;border:1px solid #3f3f46;border-radius:8px;font-weight:600;cursor:pointer;">Skip</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('submitFeedback').onclick = async () => {
                const feature = document.querySelector('input[name="feature"]:checked');
                const source = document.getElementById('feedbackSource').value;

                if (feature) {
                    try {
                        await fetch(`${API_BASE}/feedback`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                mostExcitedFeature: feature.value,
                                howHeard: source
                            }),
                            credentials: 'include'
                        });
                    } catch (error) {
                        console.error('Feedback error:', error);
                    }

                    localStorage.setItem('feedbackShown', 'true');
                    modal.remove();
                    alert('Thank you for your feedback! 🙏');
                } else {
                    alert('Please select a feature');
                }
            };

            document.getElementById('skipFeedback').onclick = () => {
                localStorage.setItem('feedbackShown', 'true');
                modal.remove();
            };
        }, 2000);
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
    });
    window.location.href = 'index.html';
});

// Modal controls
const createGroupModal = document.getElementById('createGroupModal');
const instantShareModal = document.getElementById('instantShareModal');

document.getElementById('createGroupBtn').addEventListener('click', () => {
    createGroupModal.style.display = 'block';
});

document.getElementById('instantShareBtn').addEventListener('click', () => {
    instantShareModal.style.display = 'block';
});

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});

// Create Group Form
// document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
//     e.preventDefault();

//     const groupName = document.getElementById('groupName').value;
//     const photos = document.getElementById('groupPhotos').files;

//     if (photos.length === 0) {
//         alert('Please select photos');
//         return;
//     }

//     const formData = new FormData();
//     formData.append('groupName', groupName);

//     for (let photo of photos) {
//         formData.append('photos', photo);
//     }

//     const progressDiv = document.getElementById('upload-progress');
//     const submitBtn = e.target.querySelector('button[type="submit"]');
//     submitBtn.disabled = true;
//     submitBtn.textContent = '⏳ Creating...';
//     progressDiv.innerHTML = `
//         <div class="loading-spinner">
//             <p>🔄 Uploading ${photos.length} photo(s)...</p>
//             <p>⏱️ This may take 30-60 seconds</p>
//             <p style="font-size: 12px; color: #888;">Detecting faces and removing duplicates...</p>
//         </div>
//     `;

//     try {
//         const response = await fetch(`${API_BASE}/create-group`, {
//             method: 'POST',
//             body: formData,
//             credentials: 'include'
//         });

//         const data = await response.json();

//         if (data.success) {
//             // FIX 2: Show detected users for confirmation
//             detectedUsersData = data.detectedUsers;
//             pendingGroupData = { groupId: data.groupId, groupName };

//             document.getElementById('createGroupForm').style.display = 'none';
//             progressDiv.style.display = 'none';

//             const detectedSection = document.getElementById('detectedUsersSection');
//             detectedSection.style.display = 'block';

//             displayDetectedUsers();
//         } else {
//             alert(data.error || 'Failed to create group');
//             progressDiv.textContent = '';
//         }
//     } catch (error) {
//         console.error('Create group error:', error);
//         alert('Failed to create group');
//         progressDiv.textContent = '';
//     }
// });
async function getPhotosInTimeRange(startTime, endTime) {
    if (!selectedFolder) {
        alert('⚠️ Please select a photo folder first');
        throw new Error('No folder selected');
    }

    const photos = [];
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const progressDiv = document.getElementById('upload-progress');
    progressDiv.innerHTML = '<p>🔍 Scanning folder for photos in time range...</p>';

    try {
        // Recursively scan folder (including subfolders)
        async function scanFolder(dirHandle, path = '') {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    // Check if it's an image file
                    if (entry.name.match(/\.(jpg|jpeg|png|heic|heif|webp)$/i)) {
                        try {
                            const file = await entry.getFile();
                            const fileDate = new Date(file.lastModified);

                            // Check if file is in time range
                            if (fileDate >= startDate && fileDate <= endDate) {
                                photos.push(file);
                                progressDiv.innerHTML = `<p>🔍 Found ${photos.length} photos so far...</p>`;
                            }
                        } catch (err) {
                            console.warn(`Skipping file ${entry.name}:`, err);
                        }
                    }
                } else if (entry.kind === 'directory') {
                    // Recursively scan subdirectories
                    await scanFolder(entry, path + entry.name + '/');
                }
            }
        }

        await scanFolder(selectedFolder);

    } catch (error) {
        console.error('Error scanning folder:', error);
        throw error;
    }

    return photos;
}
document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const groupName = document.getElementById('groupName').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const manualPhotos = document.getElementById('groupPhotos').files;

    // Validate: need either (folder + time range) OR manual photos
    const hasAutomatic = selectedFolder && startTime && endTime;
    const hasManual = manualPhotos.length > 0;

    if (!hasAutomatic && !hasManual) {
        alert('⚠️ Please either:\n1. Select folder + time range, OR\n2. Manually select photos');
        return;
    }

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
        alert('⚠️ End time must be after start time');
        return;
    }

    const progressDiv = document.getElementById('upload-progress');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing...';

    try {
        let photosToUpload = [];

        // Try automatic selection first
        if (hasAutomatic) {
            progressDiv.innerHTML = '<p>🔍 Scanning folder for photos...</p>';
            const autoPhotos = await getPhotosInTimeRange(startTime, endTime);

            if (autoPhotos.length > 0) {
                photosToUpload = autoPhotos;
                progressDiv.innerHTML = `<p>✅ Found ${autoPhotos.length} photos automatically</p>`;
            } else {
                alert('⚠️ No photos found in time range. Using manual selection instead.');
            }
        }

        // Fallback to manual selection
        if (photosToUpload.length === 0 && hasManual) {
            photosToUpload = Array.from(manualPhotos);
            progressDiv.innerHTML = `<p>📷 Using ${photosToUpload.length} manually selected photos</p>`;
        }

        // Final check
        if (photosToUpload.length === 0) {
            alert('❌ No photos to upload');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Group';
            progressDiv.innerHTML = '';
            return;
        }

        // Limit to 50 photos
        if (photosToUpload.length > 50) {
            const proceed = confirm(`Found ${photosToUpload.length} photos. Only the first 50 will be uploaded. Continue?`);
            if (!proceed) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Group';
                progressDiv.innerHTML = '';
                return;
            }
            photosToUpload = photosToUpload.slice(0, 50);
        }

        // Upload photos
        const formData = new FormData();
        formData.append('groupName', groupName);

        for (let photo of photosToUpload) {
            formData.append('photos', photo);
        }

        submitBtn.textContent = '⏳ Uploading...';
        progressDiv.innerHTML = `
            <div class="loading-spinner">
                <p>📤 Uploading ${photosToUpload.length} photo(s)...</p>
                <p>⏱️ This may take 30-90 seconds</p>
                <p style="font-size: 12px; color: #888;">Detecting faces and removing duplicates...</p>
            </div>
        `;

        const response = await fetch(`${API_BASE}/create-group`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            detectedUsersData = data.detectedUsers;
            pendingGroupData = { groupId: data.groupId, groupName };

            document.getElementById('createGroupForm').style.display = 'none';
            progressDiv.style.display = 'none';

            const detectedSection = document.getElementById('detectedUsersSection');
            detectedSection.style.display = 'block';

            displayDetectedUsers();
        } else {
            alert(data.error || 'Failed to create group');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Group';
            progressDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('Create group error:', error);
        alert('Failed to create group: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Group';
        progressDiv.innerHTML = '';
    }
});
function displayDetectedUsers() {
    const listDiv = document.getElementById('detectedUsersList');
    listDiv.innerHTML = '';

    detectedUsersData.forEach((user, index) => {
        const tag = document.createElement('div');
        tag.className = 'user-tag';
        tag.innerHTML = `
            ${user.username}
            <button onclick="removeDetectedUser(${index})">×</button>
        `;
        listDiv.appendChild(tag);
    });
    const infoMessage = document.createElement('p');
    infoMessage.style.cssText = 'font-size: 11px; color: #71717a; margin-top: 12px; font-style: italic;';
    infoMessage.textContent = "Others aren't on Sorted, ask them to join";
    listDiv.appendChild(infoMessage);
}

function removeDetectedUser(index) {
    console.log('BEFORE REMOVE:', JSON.parse(JSON.stringify(detectedUsersData)));
    detectedUsersData.splice(index, 1);
    console.log('AFTER REMOVE:', JSON.parse(JSON.stringify(detectedUsersData)));
    displayDetectedUsers();
}

// Add additional user
document.getElementById('addUserBtn').addEventListener('click', () => {
    const username = document.getElementById('additionalUsername').value.trim();
    if (username) {
        detectedUsersData.push({ username });
        displayDetectedUsers();
        document.getElementById('additionalUsername').value = '';
    }
});

// Confirm group creation
// document.getElementById('confirmGroupBtn').addEventListener('click', async () => {
//     try {
//         console.log("enetered  confirmGroupBtn event listeener")
//         // Get currently displayed usernames (after user removed some)
//         const currentUsernames = detectedUsersData.map(u => u.username);

//         // Get original detected usernames from server
//         const originalResponse = await fetch(`${API_BASE}/group/${pendingGroupData.groupId}`, {
//             credentials: 'include'
//         });
//         const originalData = await originalResponse.json();
//         const originalMembers = originalData.group.members.map(m => m.username);

//         // Find users to remove (were auto-detected but user removed them)
//         const usersToRemove = originalMembers.filter(username =>
//             !currentUsernames.includes(username) && username !== currentUser.username
//         );

//         // Find users to add (user manually added them)
//         const usersToAdd = currentUsernames.filter(username =>
//             !originalMembers.includes(username)
//         );

//         console.log('hv cm till before removal for');
//         // Remove unwanted members
//         for (const username of usersToRemove) {
//             console.log('Trying to remove:', username);
//             const response=await fetch(`${API_BASE}/remove-member-from-group`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     groupId: pendingGroupData.groupId,
//                     username: username
//                 }),
//                 credentials: 'include'
//             });
//             result=await response.json()
//             console.log(`Remove ${username}:`, result);
//             if (!result.success) {
//                 console.error(`Failed to remove ${username}:`, result.error);
//             }
//         }

//         // Add new members
//         for (const username of usersToAdd) {
//             await fetch(`${API_BASE}/add-member-to-group`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     groupId: pendingGroupData.groupId,
//                     username: username
//                 }),
//                 credentials: 'include'
//             });
//         }

//         alert('Group created successfully!');
//         createGroupModal.style.display = 'none';
//         loadGroups();

//         // Reset form
//         document.getElementById('createGroupForm').reset();
//         document.getElementById('createGroupForm').style.display = 'block';
//         document.getElementById('detectedUsersSection').style.display = 'none';
//         selectedFolder = null;
//         document.getElementById('folderStatus').innerHTML = 'No folder selected';
//         document.getElementById('folderStatus').style.color = '#888';

//     } catch (error) {
//         console.error('Error finalizing group:', error);
//         alert('Failed to finalize group members');
//     }
// });
// View group requests button
document.getElementById('viewRequestsBtn').addEventListener('click', () => {
    document.getElementById('groupsList').style.display = 'none';
    document.getElementById('sharedPhotosSection').style.display = 'none';
    document.getElementById('groupRequestsSection').style.display = 'block';
    loadGroupRequests();
});

// Close requests section
document.getElementById('closeRequestsBtn').addEventListener('click', () => {
    document.getElementById('groupRequestsSection').style.display = 'none';
    document.getElementById('groupsList').style.display = 'grid';
});
document.getElementById('confirmGroupBtn').addEventListener('click', async () => {
    try {
        // Get currently displayed usernames
        const currentUsernames = detectedUsersData.map(u => u.username);

        // Send request to finalize group with requests
        const response = await fetch(`${API_BASE}/confirm-group-members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                groupId: pendingGroupData.groupId,
                usernamesToAdd: currentUsernames
            }),
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            const message = result.requestsSent.length > 0
                ? `✅ Group created! Membership requests sent to:\n${result.requestsSent.join(', ')}\n\nThey'll be added once they accept.`
                : '✅ Group created successfully!';
            
            alert(message);
            
            createGroupModal.style.display = 'none';
            loadGroups();

            // Reset form
            document.getElementById('createGroupForm').reset();
            document.getElementById('createGroupForm').style.display = 'block';
            document.getElementById('detectedUsersSection').style.display = 'none';
            selectedFolder = null;
            document.getElementById('folderStatus').innerHTML = 'No folder selected';
            document.getElementById('folderStatus').style.color = '#888';
        } else {
            alert('Failed to finalize group: ' + result.error);
        }

    } catch (error) {
        console.error('Error finalizing group:', error);
        alert('Failed to finalize group members');
    }
});
// Instant Share
document.getElementById('instantShareForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const photo = document.getElementById('sharePhoto').files[0];

    if (!photo) {
        alert('Please select a photo');
        return;
    }

    const formData = new FormData();
    formData.append('photo', photo);

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing...';

    const resultDiv = document.getElementById('shareResult');
    resultDiv.innerHTML = '<p class="loading">🔄 Detecting faces and sharing photo...</p>';

    try {
        const response = await fetch(`${API_BASE}/instant-share`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json();

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (data.success) {
            if (data.sentTo.length > 0) {
                resultDiv.innerHTML = `
                    <div class="success-message">
                        <p>✅ Photo shared successfully!</p>
                        <p>Sent to: <strong>${data.sentTo.join(', ')}</strong></p>
                        <button onclick="location.reload()" class="btn-secondary" style="margin-top: 15px;">Done</button>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div class="warning-message">
                        <p>⚠️ No known faces detected in photo</p>
                        <button onclick="location.reload()" class="btn-secondary" style="margin-top: 15px;">Try Another</button>
                    </div>
                `;
            }

            // Reset form
            e.target.reset();
        }
    } catch (error) {
        console.error('Instant share error:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        resultDiv.innerHTML = '<p class="error-message">❌ Failed to share photo. Please try again.</p>';
    }
});

// Load and display groups
document.getElementById('viewGroupsBtn').addEventListener('click', loadGroups);

async function loadGroups() {
    try {
        const response = await fetch(`${API_BASE}/my-groups`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            const groupsList = document.getElementById('groupsList');
            groupsList.innerHTML = '';

            data.groups.forEach(group => {
                const card = document.createElement('div');
                card.className = 'group-card';
                card.innerHTML = `
                    <h3>${group.groupName}</h3>
                    <p>Created by: ${group.createdBy.username}</p>
                    <p>${new Date(group.createdAt).toLocaleDateString()}</p>
                `;
                card.addEventListener('click', () => {
                    window.location.href = `group.html?id=${group._id}`;
                });
                groupsList.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Load groups error:', error);
    }
}
document.getElementById('selectFolderBtn').addEventListener('click', async () => {
    try {
        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            alert('❌ Your browser doesn\'t support automatic folder selection. Please use Chrome or Edge.\n\nAlternative: You can manually select photos instead.');
            return;
        }

        selectedFolder = await window.showDirectoryPicker();
        document.getElementById('folderStatus').innerHTML = `✅ Selected: <strong>${selectedFolder.name}</strong>`;
        document.getElementById('folderStatus').style.color = '#10b981';
    } catch (error) {
        if (error.name === 'AbortError') {
            // User cancelled - no error needed
            return;
        }
        console.error('Folder selection error:', error);
        alert('Failed to select folder. Please try again.');
    }
});


// Initialize
// ============================================
// SHARED PHOTOS FUNCTIONALITY
// ============================================

// View shared photos button
document.getElementById('viewSharedBtn').addEventListener('click', () => {
    document.getElementById('groupsList').style.display = 'none';
    document.getElementById('sharedPhotosSection').style.display = 'block';
    loadSharedWithMe();
});

// Close shared section
document.getElementById('closeSharedBtn').addEventListener('click', () => {
    document.getElementById('sharedPhotosSection').style.display = 'none';
    document.getElementById('groupsList').style.display = 'grid';
});

// Tab switching
document.getElementById('sharedWithMeTab').addEventListener('click', () => {
    document.getElementById('sharedWithMeTab').classList.add('active');
    document.getElementById('sharedByMeTab').classList.remove('active');
    document.getElementById('sharedWithMeContent').style.display = 'block';
    document.getElementById('sharedByMeContent').style.display = 'none';
    loadSharedWithMe();
});

document.getElementById('sharedByMeTab').addEventListener('click', () => {
    document.getElementById('sharedByMeTab').classList.add('active');
    document.getElementById('sharedWithMeTab').classList.remove('active');
    document.getElementById('sharedByMeContent').style.display = 'block';
    document.getElementById('sharedWithMeContent').style.display = 'none';
    loadSharedByMe();
});

// Load photos shared with current user
async function loadSharedWithMe() {
    try {
        const response = await fetch(`${API_BASE}/shared-with-me`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('sharedWithMePhotos');
            container.innerHTML = '';

            if (data.photos.length === 0) {
                container.innerHTML = '<p class="empty-message">No photos shared with you yet</p>';
                return;
            }

            data.photos.forEach(photo => {
                const photoDiv = document.createElement('div');
                photoDiv.className = 'photo-item' + (photo.viewed ? '' : ' unviewed');

                const img = document.createElement('img');
                img.src = `data:${photo.contentType};base64,${photo.photoData}`;
                img.addEventListener('click', () => {
                    markAsViewed(photo._id);
                    // Open full size view
                    const fullView = window.open('', '_blank');
                    fullView.document.write(`<img src="${img.src}" style="max-width:100%;height:auto;">`);
                });

                const info = document.createElement('div');
                info.className = 'photo-info';
                info.innerHTML = `
                    <p><strong>From:</strong> ${photo.sharedBy}</p>
                    <p><strong>Date:</strong> ${new Date(photo.sharedAt).toLocaleDateString()}</p>
                    <p><strong>People:</strong> ${photo.detectedFaces.map(f => f.username).join(', ')}</p>
                    ${!photo.viewed ? '<span class="badge-new">NEW</span>' : ''}
                `;

                photoDiv.appendChild(img);
                photoDiv.appendChild(info);
                container.appendChild(photoDiv);
            });
        }
    } catch (error) {
        console.error('Error loading shared photos:', error);
        alert('Failed to load shared photos');
    }
}

// Load photos shared by current user
async function loadSharedByMe() {
    try {
        const response = await fetch(`${API_BASE}/shared-by-me`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('sharedByMePhotos');
            container.innerHTML = '';

            if (data.photos.length === 0) {
                container.innerHTML = '<p class="empty-message">You haven\'t shared any photos yet</p>';
                return;
            }

            data.photos.forEach(photo => {
                const photoDiv = document.createElement('div');
                photoDiv.className = 'photo-item';

                const img = document.createElement('img');
                img.src = `data:${photo.contentType};base64,${photo.photoData}`;
                img.addEventListener('click', () => {
                    const fullView = window.open('', '_blank');
                    fullView.document.write(`<img src="${img.src}" style="max-width:100%;height:auto;">`);
                });

                const info = document.createElement('div');
                info.className = 'photo-info';
                info.innerHTML = `
                    <p><strong>Shared with:</strong> ${photo.sharedWith.join(', ')}</p>
                    <p><strong>Date:</strong> ${new Date(photo.sharedAt).toLocaleDateString()}</p>
                    <p><strong>Views:</strong> ${photo.viewCount}/${photo.sharedWith.length}</p>
                `;

                photoDiv.appendChild(img);
                photoDiv.appendChild(info);
                container.appendChild(photoDiv);
            });
        }
    } catch (error) {
        console.error('Error loading shared photos:', error);
        alert('Failed to load shared photos');
    }
}
// Load pending group requests
async function loadGroupRequests() {
    try {
        const response = await fetch(`${API_BASE}/my-group-requests`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('groupRequestsList');
            container.innerHTML = '';

            if (data.requests.length === 0) {
                container.innerHTML = '<p class="empty-message">No pending requests</p>';
                return;
            }

            data.requests.forEach(request => {
                const requestCard = document.createElement('div');
                requestCard.className = 'request-card';
                requestCard.innerHTML = `
                    <div class="request-info">
                        <h4>${request.group.groupName}</h4>
                        <p>From: <strong>${request.requestedBy.username}</strong></p>
                        <p class="request-date">${new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="request-actions">
                        <button class="btn-accept" onclick="acceptGroupRequest('${request._id}')">✓ Accept</button>
                        <button class="btn-reject" onclick="rejectGroupRequest('${request._id}')">✕ Decline</button>
                    </div>
                `;
                container.appendChild(requestCard);
            });
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

// Accept group request
window.acceptGroupRequest = async function(requestId) {
    try {
        const response = await fetch(`${API_BASE}/accept-group-request/${requestId}`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Joined group successfully!');
            loadGroupRequests();
            loadGroups(); // Refresh groups list
        } else {
            alert('Failed to accept request: ' + data.error);
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        alert('Failed to accept request');
    }
};

// Reject group request
window.rejectGroupRequest = async function(requestId) {
    if (!confirm('Decline this group invitation?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/reject-group-request/${requestId}`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            alert('Request declined');
            loadGroupRequests();
        } else {
            alert('Failed to decline request: ' + data.error);
        }
    } catch (error) {
        console.error('Error declining request:', error);
        alert('Failed to decline request');
    }
};
// Mark photo as viewed
async function markAsViewed(photoId) {
    try {
        await fetch(`${API_BASE}/mark-viewed/${photoId}`, {
            method: 'POST',
            credentials: 'include'
        });

        // Refresh the list to update badge
        loadSharedWithMe();
    } catch (error) {
        console.error('Error marking photo as viewed:', error);
    }
}

// Initialize
checkAuth();
