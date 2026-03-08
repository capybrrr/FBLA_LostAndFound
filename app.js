// app.js — FoundIt: School Lost & Found
// ============================================================
// Data storage: Cloud Firestore (Firebase)
// Three collections:
// "items" → found item documents
// "claims" → claim request documents
// "lostItems" → lost item reports
// ============================================================


// ── FIREBASE SETUP ───────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
      getFirestore, collection, doc,
      getDocs, getDoc, addDoc, updateDoc,
      deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
      apiKey: "AIzaSyDdHpMVliDaw-k1ZshXLo6XIrgM0JW22bU",
      authDomain: "fbla-lost-and-found-ef596.firebaseapp.com",
      projectId: "fbla-lost-and-found-ef596",
      storageBucket: "fbla-lost-and-found-ef596.firebasestorage.app",
      messagingSenderId: "157345036335",
      appId: "1:157345036335:web:2cd1549df6a017850b6eda",
      measurementId: "G-TM88B341V7"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const itemsCol = collection(db, 'items');
const claimsCol = collection(db, 'claims');
const lostItemsCol = collection(db, 'lostItems');


// ── DATABASE HELPERS ─────────────────────────────────────────

async function getItems() {
      const q = query(itemsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getClaims() {
      const q = query(claimsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLostItems() {
      const q = query(lostItemsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getItemById(id) {
      const snap = await getDoc(doc(db, 'items', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getLostItemById(id) {
      const snap = await getDoc(doc(db, 'lostItems', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function addItem(data) {
      const ref = await addDoc(itemsCol, { ...data, createdAt: Date.now() });
      return ref.id;
}

async function addClaim(data) {
      const ref = await addDoc(claimsCol, { ...data, createdAt: Date.now() });
      return ref.id;
}

async function addLostItem(data) {
      const ref = await addDoc(lostItemsCol, { ...data, createdAt: Date.now() });
      return ref.id;
}

async function updateItem(id, data) {
      await updateDoc(doc(db, 'items', id), data);
}

async function updateClaim(id, data) {
      await updateDoc(doc(db, 'claims', id), data);
}

async function updateLostItem(id, data) {
      await updateDoc(doc(db, 'lostItems', id), data);
}

async function removeItem(id) {
      await deleteDoc(doc(db, 'items', id));
}

async function removeLostItem(id) {
      await deleteDoc(doc(db, 'lostItems', id));
}


// ── XSS PROTECTION ───────────────────────────────────────────

function escapeHTML(str) {
      return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}


// ── EMAIL VALIDATION ─────────────────────────────────────────

function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ── NAVIGATION ───────────────────────────────────────────────

function showPage(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      const navEl = document.getElementById('nav-' + page);
      if (navEl) navEl.classList.add('active');
      window.scrollTo(0, 0);

      if (page === 'home') renderHome();
      if (page === 'browse') renderBrowse();
      if (page === 'admin') renderAdmin();
      if (page === 'map') renderMap();
      if (page === 'lost-board') renderLostBoard();
};

// ── EXPOSE TO GLOBAL SCOPE (needed for ES modules on Netlify) ─
window.showPage = showPage;


// ── HOME PAGE ────────────────────────────────────────────────

async function renderHome() {
      const grid = document.getElementById('home-items-grid');
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

      const [items, lostItems] = await Promise.all([getItems(), getLostItems()]);
      const approvedItems = items.filter(i => i.approved);
      const approvedLost = lostItems.filter(i => i.approved);

      const total = approvedItems.length;
      const available = approvedItems.filter(i => i.status === 'available').length;
      const returned = approvedItems.filter(i => i.status === 'returned').length;
      const seeking = approvedLost.filter(i => i.status === 'seeking').length;

      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-available').textContent = available;
      document.getElementById('stat-returned').textContent = returned;
      document.getElementById('stat-seeking').textContent = seeking;

      const recent = approvedItems.slice(0, 6);

      if (!recent.length) {
            grid.innerHTML = `
 <div class="empty-state">
 <div class="empty-icon">—</div>
 <h3>No items yet</h3>
 <p>Be the first to report a found item.</p>
 </div>`;
            return;
      }

      grid.innerHTML = recent.map(item => itemCardHTML(item)).join('');
}


// ── BROWSE PAGE ──────────────────────────────────────────────

async function renderBrowse() {
      const queryText = (document.getElementById('search-input')?.value || '').toLowerCase();
      const cat = document.getElementById('filter-category')?.value || '';
      const status = document.getElementById('filter-status')?.value || '';

      const grid = document.getElementById('browse-grid');
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

      let items = (await getItems()).filter(i => i.approved);

      if (queryText) {
            items = items.filter(i =>
                  i.name.toLowerCase().includes(queryText) ||
                  i.description?.toLowerCase().includes(queryText) ||
                  i.location.toLowerCase().includes(queryText)
            );
      }
      if (cat) items = items.filter(i => i.category === cat);
      if (status) items = items.filter(i => i.status === status);

      if (!items.length) {
            grid.innerHTML = `
 <div class="empty-state" style="grid-column:1/-1">
 <div class="empty-icon">—</div>
 <h3>No items found</h3>
 <p>Try adjusting your search or filters.</p>
 </div>`;
            return;
      }

      grid.innerHTML = items.map(item => itemCardHTML(item)).join('');
}


// ── LOST BOARD PAGE ──────────────────────────────────────────

async function renderLostBoard() {
      const queryText = (document.getElementById('lost-search-input')?.value || '').toLowerCase();
      const cat = document.getElementById('lost-filter-category')?.value || '';

      const grid = document.getElementById('lost-board-grid');
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

      let items = (await getLostItems()).filter(i => i.approved);

      if (queryText) {
            items = items.filter(i =>
                  i.name.toLowerCase().includes(queryText) ||
                  i.description?.toLowerCase().includes(queryText) ||
                  i.lastLocation?.toLowerCase().includes(queryText)
            );
      }
      if (cat) items = items.filter(i => i.category === cat);

      if (!items.length) {
            grid.innerHTML = `
 <div class="empty-state" style="grid-column:1/-1">
 <div class="empty-icon">—</div>
 <h3>No lost item reports</h3>
 <p>Try adjusting your search, or <a href="#" onclick="showPage('report-lost')" style="color:var(--warning)">report your lost item</a>.</p>
 </div>`;
            return;
      }

      grid.innerHTML = items.map(item => lostItemCardHTML(item)).join('');
}


// ── SHARED HELPERS ───────────────────────────────────────────

function itemCardHTML(item) {
      const emoji = categoryEmoji(item.category);
      const imgHTML = item.photo
            ? `<div class="item-card-img"><img src="${item.photo}" alt="${escapeHTML(item.name)}"></div>`
            : `<div class="item-card-img">${emoji}</div>`;

      return `
 <div class="item-card" onclick='openModal("${escapeHTML(item.id)}")'>
 ${imgHTML}
 <div class="item-card-body">
 <div class="item-card-title">${escapeHTML(item.name)}</div>
 <div class="item-card-meta">
 <span>${escapeHTML(item.location)}</span>
 <span>${escapeHTML(item.date)}</span>
 </div>
 <span class="badge badge-${escapeHTML(item.status)}">${statusLabel(item.status)}</span>
 </div>
 </div>`;
}

function lostItemCardHTML(item) {
      const emoji = categoryEmoji(item.category);
      const imgHTML = item.photo
            ? `<div class="item-card-img item-card-img-lost"><img src="${item.photo}" alt="${escapeHTML(item.name)}"></div>`
            : `<div class="item-card-img item-card-img-lost">${emoji}</div>`;

      const statusBadge = item.status === 'found'
            ? `<span class="badge badge-returned">Found!</span>`
            : `<span class="badge badge-lost-seeking">Still Missing</span>`;

      return `
 <div class="item-card item-card-lost" onclick='openLostModal("${escapeHTML(item.id)}")'>
 ${imgHTML}
 <div class="item-card-body">
 <div class="item-card-title">${escapeHTML(item.name)}</div>
 <div class="item-card-meta">
 ${item.lastLocation ? `<span>Last seen: ${escapeHTML(item.lastLocation)}</span>` : ''}
 <span>${escapeHTML(item.dateLost)}</span>
 </div>
 ${statusBadge}
 </div>
 </div>`;
}

function categoryEmoji(cat) {
      const map = {
            'Electronics': 'ELEC',
            'Clothing': 'CLTH',
            'Books & Stationery': 'BOOK',
            'Bags & Accessories': 'BAGS',
            'Sports Equipment': 'SPRT',
            'Keys & Cards': 'KEYS',
            'Other': 'ITEM',
      };
      return map[cat] || 'ITEM';
}

function statusLabel(s) {
      return { available: 'Available', claimed: 'Claim Pending', returned: 'Returned' }[s] || s;
}


// ── ITEM DETAIL MODAL (found items) ─────────────────────────

window.openModal = async function (id) {
      document.getElementById('modal-content').innerHTML =
            `<p style="text-align:center;padding:2rem">Loading…</p>`;
      document.getElementById('item-modal').classList.add('open');

      const item = await getItemById(id);
      if (!item) { closeModal(); return; }

      const emoji = categoryEmoji(item.category);
      const imgHTML = item.photo
            ? `<div class="modal-img"><img src="${item.photo}" alt="${escapeHTML(item.name)}"></div>`
            : `<div class="modal-img">${emoji}</div>`;

      const canClaim = item.status === 'available';

      document.getElementById('modal-content').innerHTML = `
 <h2>${escapeHTML(item.name)}</h2>
 <span class="badge badge-${escapeHTML(item.status)}">${statusLabel(item.status)}</span>
 ${imgHTML}
 <p class="modal-detail"><strong>Category:</strong> ${escapeHTML(item.category)}</p>
 <p class="modal-detail"><strong>Found at:</strong> ${escapeHTML(item.location)}</p>
 <p class="modal-detail"><strong>Date found:</strong> ${escapeHTML(item.date)}</p>
 ${item.description ? `<p class="modal-detail"><strong>Description:</strong> ${escapeHTML(item.description)}</p>` : ''}
 <p class="modal-detail"><strong>Reported by:</strong> ${escapeHTML(item.finder)}</p>
 <div class="modal-actions">
 ${canClaim ? `<button class="btn btn-primary" onclick='openClaimModal("${escapeHTML(item.id)}")'>✋ This is Mine — Claim It</button>` : ''}
 <button class="btn btn-secondary" onclick="closeModal()">Close</button>
 </div>`;
};

window.closeModal = function () {
      document.getElementById('item-modal').classList.remove('open');
};


// ── LOST ITEM DETAIL MODAL ───────────────────────────────────

window.openLostModal = async function (id) {
      document.getElementById('modal-content').innerHTML =
            `<p style="text-align:center;padding:2rem">Loading…</p>`;
      document.getElementById('item-modal').classList.add('open');

      const item = await getLostItemById(id);
      if (!item) { closeModal(); return; }

      const emoji = categoryEmoji(item.category);
      const imgHTML = item.photo
            ? `<div class="modal-img modal-img-lost"><img src="${item.photo}" alt="${escapeHTML(item.name)}"></div>`
            : `<div class="modal-img modal-img-lost">${emoji}</div>`;

      const stillMissing = item.status !== 'found';

      document.getElementById('modal-content').innerHTML = `
 <div class="modal-lost-banner">🔍 Lost Item Report</div>
 <h2>${escapeHTML(item.name)}</h2>
 ${stillMissing
                  ? `<span class="badge badge-lost-seeking">Still Missing</span>`
                  : `<span class="badge badge-returned">Found!</span>`}
 ${imgHTML}
 <p class="modal-detail"><strong>Category:</strong> ${escapeHTML(item.category)}</p>
 ${item.lastLocation ? `<p class="modal-detail"><strong>Last seen near:</strong> ${escapeHTML(item.lastLocation)}</p>` : ''}
 <p class="modal-detail"><strong>Date lost:</strong> ${escapeHTML(item.dateLost)}</p>
 ${item.description ? `<p class="modal-detail"><strong>Description:</strong> ${escapeHTML(item.description)}</p>` : ''}
 <p class="modal-detail"><strong>Contact:</strong> <a href="mailto:${escapeHTML(item.email)}" style="color:var(--accent)">${escapeHTML(item.email)}</a></p>
 ${stillMissing ? `
 <div class="modal-lost-tip">
 <strong>Found this item?</strong> Email the owner directly or hand it in to the Main Office and let them know the report ID.
 </div>` : ''}
 <div class="modal-actions">
 <button class="btn btn-secondary" onclick="closeModal()">Close</button>
 </div>`;
};


// ── CLAIM MODAL ──────────────────────────────────────────────

window.openClaimModal = function (itemId) {
      closeModal();
      document.getElementById('claim-item-id').value = itemId;
      document.getElementById('claim-name').value = '';
      document.getElementById('claim-email').value = '';
      document.getElementById('claim-sid').value = '';
      document.getElementById('claim-message').value = '';
      document.getElementById('claim-modal').classList.add('open');
};

window.closeClaimModal = function () {
      document.getElementById('claim-modal').classList.remove('open');
};

async function submitClaim() {
      const name = document.getElementById('claim-name').value.trim();
      const email = document.getElementById('claim-email').value.trim();
      const message = document.getElementById('claim-message').value.trim();
      const itemId = document.getElementById('claim-item-id').value;

      if (!name || !email || !message) {
            showToast('Please fill in all required fields.', 'error'); return;
      }
      if (!isValidEmail(email)) {
            showToast('Please enter a valid email address.', 'error'); return;
      }
      if (message.length < 10) {
            showToast('Please describe why this item is yours (at least 10 characters).', 'error'); return;
      }

      try {
            await addClaim({
                  itemId,
                  name,
                  email,
                  sid: document.getElementById('claim-sid').value.trim(),
                  message,
                  date: new Date().toLocaleDateString(),
                  status: 'pending',
            });
            await updateItem(itemId, { status: 'claimed' });

            closeClaimModal();
            showToast('Claim submitted! An admin will be in touch.', 'success');
            renderBrowse();
      } catch (err) {
            console.error('submitClaim:', err);
            showToast('Something went wrong. Please try again.', 'error');
      }
};


// ── REPORT FOUND FORM ────────────────────────────────────────

let uploadedPhoto = null;

function handlePhotoUpload(input) {
      const file = input.files[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
            showToast('Please upload an image file (JPG, PNG, GIF, or WebP).', 'error');
            input.value = ''; return;
      }
      if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5MB.', 'error');
            input.value = ''; return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
            uploadedPhoto = e.target.result;
            document.getElementById('upload-preview').innerHTML =
                  `<img src="${uploadedPhoto}" alt="preview">`;
      };
      reader.readAsDataURL(file);
};

async function submitReport(e) {
      e.preventDefault();

      const name = document.getElementById('r-name').value.trim();
      const category = document.getElementById('r-category').value;
      const location = document.getElementById('r-location').value.trim();
      const date = document.getElementById('r-date').value;
      const finder = document.getElementById('r-finder').value.trim();
      const email = document.getElementById('r-email').value.trim();

      if (!name || !category || !location || !date || !finder || !email) {
            showToast('Please fill in all required fields.', 'error'); return;
      }
      if (!isValidEmail(email)) {
            showToast('Please enter a valid email address.', 'error'); return;
      }
      if (name.length < 2) {
            showToast('Please enter a more descriptive item name.', 'error'); return;
      }

      try {
            await addItem({
                  name, category, location, date,
                  description: document.getElementById('r-description').value.trim(),
                  finder, email,
                  photo: uploadedPhoto,
                  status: 'available',
                  approved: false,
            });

            uploadedPhoto = null;
            document.getElementById('report-form').reset();
            document.getElementById('upload-preview').innerHTML = '';
            document.getElementById('r-date').valueAsDate = new Date();
            showToast('Item submitted! It will appear after admin approval.', 'success');
      } catch (err) {
            console.error('submitReport:', err);
            showToast('Something went wrong. Please try again.', 'error');
      }
};


// ── REPORT LOST FORM ─────────────────────────────────────────

let uploadedLostPhoto = null;

function handleLostPhotoUpload(input) {
      const file = input.files[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
            showToast('Please upload an image file (JPG, PNG, GIF, or WebP).', 'error');
            input.value = ''; return;
      }
      if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5MB.', 'error');
            input.value = ''; return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
            uploadedLostPhoto = e.target.result;
            document.getElementById('lost-upload-preview').innerHTML =
                  `<img src="${uploadedLostPhoto}" alt="preview">`;
      };
      reader.readAsDataURL(file);
};

async function submitLostReport(e) {
      e.preventDefault();

      const name = document.getElementById('rl-name').value.trim();
      const category = document.getElementById('rl-category').value;
      const lastLocation = document.getElementById('rl-location').value.trim();
      const dateLost = document.getElementById('rl-date').value;
      const ownerName = document.getElementById('rl-owner').value.trim();
      const email = document.getElementById('rl-email').value.trim();

      if (!name || !category || !dateLost || !ownerName || !email) {
            showToast('Please fill in all required fields.', 'error'); return;
      }
      if (!isValidEmail(email)) {
            showToast('Please enter a valid email address.', 'error'); return;
      }
      if (name.length < 2) {
            showToast('Please enter a more descriptive item name.', 'error'); return;
      }

      try {
            await addLostItem({
                  name, category, lastLocation, dateLost,
                  description: document.getElementById('rl-description').value.trim(),
                  ownerName, email,
                  photo: uploadedLostPhoto,
                  status: 'seeking',
                  approved: false,
            });

            uploadedLostPhoto = null;
            document.getElementById('report-lost-form').reset();
            document.getElementById('lost-upload-preview').innerHTML = '';
            document.getElementById('rl-date').valueAsDate = new Date();
            showToast('Lost item reported! It will appear after admin approval.', 'success');
      } catch (err) {
            console.error('submitLostReport:', err);
            showToast('Something went wrong. Please try again.', 'error');
      }
};


// ── ADMIN ────────────────────────────────────────────────────

let adminLoggedIn = false;

function adminLogin() {
      const pw = document.getElementById('admin-password').value;
      const errEl = document.getElementById('admin-pw-error');
      if (pw === 'admin123') {
            errEl.style.display = 'none';
            adminLoggedIn = true;
            document.getElementById('admin-login-view').style.display = 'none';
            document.getElementById('admin-panel-view').style.display = 'block';
            renderAdminItems();
      } else {
            errEl.style.display = 'block';
            document.getElementById('admin-password').focus();
      }
};

function adminTab(tab, el) {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('admin-items-view').style.display = tab === 'items' ? 'block' : 'none';
      document.getElementById('admin-claims-view').style.display = tab === 'claims' ? 'block' : 'none';
      document.getElementById('admin-lost-view').style.display = tab === 'lost' ? 'block' : 'none';
      if (tab === 'items') renderAdminItems();
      if (tab === 'claims') renderAdminClaims();
      if (tab === 'lost') renderAdminLost();
};

function renderAdmin() {
      if (!adminLoggedIn) {
            document.getElementById('admin-login-view').style.display = 'block';
            document.getElementById('admin-panel-view').style.display = 'none';
      } else {
            renderAdminItems();
      }
}

async function renderAdminItems() {
      const tbody = document.getElementById('admin-items-tbody');
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mid);padding:2rem">Loading…</td></tr>`;

      const items = await getItems();

      if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mid);padding:2rem">No items submitted yet.</td></tr>`;
            return;
      }

      tbody.innerHTML = items.map(item => `
 <tr>
 <td><strong>${escapeHTML(item.name)}</strong></td>
 <td>${escapeHTML(item.category)}</td>
 <td>${escapeHTML(item.location)}</td>
 <td>${escapeHTML(item.date)}</td>
 <td>${escapeHTML(item.finder)}</td>
 <td>
 <span class="badge badge-${item.status}">
 ${item.approved ? statusLabel(item.status) : '⏳ Pending'}
 </span>
 </td>
 <td>
 <div class="table-actions">
 ${!item.approved
                  ? `<button class="btn btn-sm btn-success" onclick="approveItem('${item.id}')">✓ Approve</button>`
                  : ''}
 ${item.approved && item.status !== 'returned'
                  ? `<button class="btn btn-sm btn-secondary" onclick="markReturned('${item.id}')">Returned</button>`
                  : ''}
 <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
 </div>
 </td>
 </tr>`).join('');
}

window.approveItem = async function (id) {
      try {
            await updateItem(id, { approved: true });
            renderAdminItems();
            showToast('Item approved and listed.', 'success');
      } catch (err) { showToast('Error approving item.', 'error'); }
};

window.markReturned = async function (id) {
      try {
            await updateItem(id, { status: 'returned' });
            renderAdminItems();
            showToast('Item marked as returned.', 'success');
      } catch (err) { showToast('Error updating item.', 'error'); }
};

window.deleteItem = async function (id) {
      if (!confirm('Delete this item?')) return;
      try {
            await removeItem(id);
            renderAdminItems();
            showToast('Item deleted.');
      } catch (err) { showToast('Error deleting item.', 'error'); }
};

async function renderAdminClaims() {
      const tbody = document.getElementById('admin-claims-tbody');
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--mid);padding:2rem">Loading…</td></tr>`;

      const [claims, items] = await Promise.all([getClaims(), getItems()]);

      if (!claims.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--mid);padding:2rem">No claim requests yet.</td></tr>`;
            return;
      }

      tbody.innerHTML = claims.map(claim => {
            const item = items.find(i => i.id === claim.itemId);
            return `
 <tr>
 <td>
 <strong>${escapeHTML(claim.name)}</strong>
 ${claim.sid ? `<br><span style="color:var(--mid);font-size:0.8rem">ID: ${escapeHTML(claim.sid)}</span>` : ''}
 </td>
 <td>${item ? escapeHTML(item.name) : '(deleted)'}</td>
 <td style="max-width:200px">${escapeHTML(claim.message)}</td>
 <td><a href="mailto:${escapeHTML(claim.email)}" style="color:var(--accent)">${escapeHTML(claim.email)}</a></td>
 <td>${escapeHTML(claim.date)}</td>
 <td>
 <div class="table-actions">
 <span class="badge badge-${escapeHTML(claim.status)}">${escapeHTML(claim.status)}</span>
 ${claim.status === 'pending' ? `
 <button class="btn btn-sm btn-success" onclick="approveClaim('${escapeHTML(claim.id)}','${escapeHTML(claim.itemId)}')">✓ Approve</button>
 <button class="btn btn-sm btn-danger" onclick="rejectClaim('${escapeHTML(claim.id)}','${escapeHTML(claim.itemId)}')">✗</button>
 ` : ''}
 </div>
 </td>
 </tr>`;
      }).join('');
}

window.approveClaim = async function (claimId, itemId) {
      try {
            await Promise.all([
                  updateClaim(claimId, { status: 'approved' }),
                  updateItem(itemId, { status: 'returned' }),
            ]);
            renderAdminClaims();
            showToast('Claim approved. Item marked as returned.', 'success');
      } catch (err) { showToast('Error approving claim.', 'error'); }
};

window.rejectClaim = async function (claimId, itemId) {
      try {
            await Promise.all([
                  updateClaim(claimId, { status: 'rejected' }),
                  updateItem(itemId, { status: 'available' }),
            ]);
            renderAdminClaims();
            showToast('Claim rejected. Item set back to available.');
      } catch (err) { showToast('Error rejecting claim.', 'error'); }
};

// ── ADMIN: LOST ITEMS ────────────────────────────────────────

async function renderAdminLost() {
      const tbody = document.getElementById('admin-lost-tbody');
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mid);padding:2rem">Loading…</td></tr>`;

      const items = await getLostItems();

      if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mid);padding:2rem">No lost item reports yet.</td></tr>`;
            return;
      }

      tbody.innerHTML = items.map(item => `
 <tr>
 <td><strong>${escapeHTML(item.name)}</strong></td>
 <td>${escapeHTML(item.category)}</td>
 <td>${escapeHTML(item.lastLocation || '—')}</td>
 <td>${escapeHTML(item.dateLost)}</td>
 <td>${escapeHTML(item.ownerName)}</td>
 <td>
 <span class="badge ${item.approved ? (item.status === 'found' ? 'badge-returned' : 'badge-lost-seeking') : 'badge-pending'}">
 ${item.approved ? (item.status === 'found' ? 'Found' : 'Seeking') : '⏳ Pending'}
 </span>
 </td>
 <td>
 <div class="table-actions">
 ${!item.approved
                  ? `<button class="btn btn-sm btn-success" onclick="approveLostItem('${item.id}')">✓ Approve</button>`
                  : ''}
 ${item.approved && item.status === 'seeking'
                  ? `<button class="btn btn-sm btn-secondary" onclick="markLostFound('${item.id}')">Mark Found</button>`
                  : ''}
 <button class="btn btn-sm btn-danger" onclick="deleteLostItem('${item.id}')">Delete</button>
 </div>
 </td>
 </tr>`).join('');
}

window.approveLostItem = async function (id) {
      try {
            await updateLostItem(id, { approved: true });
            renderAdminLost();
            showToast('Lost item report approved and listed.', 'success');
      } catch (err) { showToast('Error approving lost item.', 'error'); }
};

window.markLostFound = async function (id) {
      try {
            await updateLostItem(id, { status: 'found' });
            renderAdminLost();
            showToast('Item marked as found!', 'success');
      } catch (err) { showToast('Error updating lost item.', 'error'); }
};

window.deleteLostItem = async function (id) {
      if (!confirm('Delete this lost item report?')) return;
      try {
            await removeLostItem(id);
            renderAdminLost();
            showToast('Lost item report deleted.');
      } catch (err) { showToast('Error deleting lost item.', 'error'); }
};


// ── MAP PAGE ─────────────────────────────────────────────────

const LOCATION_COORDS = {
      'Main Office': [110, 75],
      'Library': [130, 235],
      'Auditorium': [130, 430],
      'Main Entrance': [450, 500],
      'Cafeteria': [680, 95],
      'Main Gym': [680, 290],
      'Locker Room': [680, 465],
      'Room 101': [320, 65],
      'Room 102': [430, 65],
      'Room 103': [530, 65],
      'Room 201': [320, 195],
      'Room 202': [430, 195],
      'Room 203': [530, 195],
      'Room 204': [320, 305],
      'Science Wing': [430, 305],
      'Art Room': [530, 305],
      'Music Room': [320, 415],
      'Hallway - 1st Floor': [450, 140],
      'Hallway - 2nd Floor': [450, 248],
      'Athletic Field': [190, 529],
      'Parking Lot': [815, 529],
};

const PIN_COLOURS = {
      available: '#2B6CB0',
      claimed: '#d97706',
      returned: '#16a34a',
};

async function renderMap() {
      const pinsGroup = document.getElementById('map-pins');
      pinsGroup.innerHTML = '';

      const items = (await getItems()).filter(i => i.approved);

      const byLocation = {};
      items.forEach(item => {
            const key = item.location.trim();
            if (!byLocation[key]) byLocation[key] = [];
            byLocation[key].push(item);
      });

      const listed = [];
      const unlisted = [];

      Object.entries(byLocation).forEach(([loc, locItems]) => {
            let coords = LOCATION_COORDS[loc];
            if (!coords) {
                  const lower = loc.toLowerCase();
                  const key = Object.keys(LOCATION_COORDS).find(k => k.toLowerCase() === lower);
                  if (key) coords = LOCATION_COORDS[key];
            }
            if (coords) listed.push({ loc, items: locItems, coords });
            else unlisted.push(...locItems);
      });

      listed.forEach(({ loc, items: locItems, coords }) => {
            const [cx, cy] = coords;
            const count = locItems.length;

            let colour = PIN_COLOURS.returned;
            if (locItems.some(i => i.status === 'claimed')) colour = PIN_COLOURS.claimed;
            if (locItems.some(i => i.status === 'available')) colour = PIN_COLOURS.available;

            const lines = locItems.slice(0, 3).map(i => `• ${escapeHTML(i.name)}`);
            if (locItems.length > 3) lines.push(`+ ${locItems.length - 3} more`);
            const tipText = `<strong>${escapeHTML(loc)}</strong><br>${lines.join('<br>')}`;

            const clickHandler = count === 1
                  ? `openModal('${escapeHTML(locItems[0].id)}')`
                  : `openMapGroup('${escapeHTML(loc)}')`;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'map-pin-group');
            g.setAttribute('onclick', clickHandler);
            g.innerHTML = `
 <circle class="map-pin-circle" cx="${cx}" cy="${cy}" r="${count === 1 ? 12 : 14}"
 fill="${colour}" stroke="#fff" stroke-width="2.5" opacity="0.93"/>
 <text class="map-pin-count" x="${cx}" y="${cy}">${count > 1 ? count : '!'}</text>`;

            g.addEventListener('mouseenter', (e) => showMapTooltip(e, tipText));
            g.addEventListener('mouseleave', hideMapTooltip);
            pinsGroup.appendChild(g);
      });

      const unlistedSection = document.getElementById('map-unlisted');
      const unlistedGrid = document.getElementById('map-unlisted-grid');

      if (unlisted.length) {
            unlistedSection.style.display = 'block';
            unlistedGrid.innerHTML = unlisted.map(item => itemCardHTML(item)).join('');
      } else {
            unlistedSection.style.display = 'none';
            unlistedGrid.innerHTML = '';
      }
}

function showMapTooltip(e, html) {
      const tip = document.getElementById('map-tooltip');
      tip.innerHTML = html;
      tip.classList.add('visible');
      positionTooltip(e);
}

function hideMapTooltip() {
      document.getElementById('map-tooltip').classList.remove('visible');
}

function positionTooltip(e) {
      const tip = document.getElementById('map-tooltip');
      const wrap = document.getElementById('map-inner');
      const rect = wrap.getBoundingClientRect();
      let x = e.clientX - rect.left + 14;
      let y = e.clientY - rect.top - 10;
      if (x + 230 > rect.width) x = e.clientX - rect.left - 240;
      if (y + 80 > rect.height) y = e.clientY - rect.top - 80;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
}

document.addEventListener('mousemove', (e) => {
      const tip = document.getElementById('map-tooltip');
      if (tip && tip.classList.contains('visible')) positionTooltip(e);
});

window.openMapGroup = async function (loc) {
      document.getElementById('modal-content').innerHTML =
            `<p style="text-align:center;padding:2rem">Loading…</p>`;
      document.getElementById('item-modal').classList.add('open');

      const items = (await getItems()).filter(i => i.approved && i.location.trim() === loc);

      const listHTML = items.map(item => `
 <div onclick="openModal('${escapeHTML(item.id)}')"
 style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;
 border-bottom:1px solid var(--border);cursor:pointer;">
 <span class="badge badge-${escapeHTML(item.status)}" style="flex-shrink:0">${statusLabel(item.status)}</span>
 <span style="font-weight:500">${escapeHTML(item.name)}</span>
 <span style="color:var(--mid);font-size:0.82rem;margin-left:auto">${escapeHTML(item.date)}</span>
 </div>`).join('');

      document.getElementById('modal-content').innerHTML = `
 <h2>📍 ${escapeHTML(loc)}</h2>
 <p class="text-mid" style="margin-bottom:1rem;font-size:0.9rem">
 ${items.length} item${items.length !== 1 ? 's' : ''} found here — click one to view details.
 </p>
 ${listHTML}
 <div class="modal-actions" style="margin-top:1rem">
 <button class="btn btn-secondary" onclick="closeModal()">Close</button>
 </div>`;
};


// ── TOAST NOTIFICATION ───────────────────────────────────────

function showToast(msg, type = '') {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3200);
}


// ── INITIALISATION ───────────────────────────────────────────

document.getElementById('r-date').valueAsDate = new Date();
document.getElementById('rl-date').valueAsDate = new Date();
renderHome();

// ── EVENT BINDING ────────────────────────────────────────────

function bindEvents() {
      // ── Nav links ──
      const nav = (id, page) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', e => { e.preventDefault(); showPage(page); });
      };
      nav('nav-home', 'home');
      nav('nav-browse', 'browse');
      nav('nav-report', 'report');
      nav('nav-report-lost', 'report-lost');
      nav('nav-lost-board', 'lost-board');
      nav('nav-map', 'map');
      nav('nav-admin', 'admin');
      document.querySelector('.nav-logo')
            ?.addEventListener('click', e => { e.preventDefault(); showPage('home'); });

      // ── Hero buttons ──
      document.getElementById('btn-browse-hero')
            ?.addEventListener('click', () => showPage('browse'));
      document.getElementById('btn-report-hero')
            ?.addEventListener('click', () => showPage('report'));
      document.getElementById('btn-report-lost-hero')
            ?.addEventListener('click', () => showPage('report-lost'));
      document.getElementById('btn-lost-board-hero')
            ?.addEventListener('click', () => showPage('lost-board'));
      document.getElementById('link-view-all')
            ?.addEventListener('click', e => { e.preventDefault(); showPage('browse'); });
      document.getElementById('link-view-lost')
            ?.addEventListener('click', e => { e.preventDefault(); showPage('lost-board'); });

      // ── Browse filters ──
      document.getElementById('search-input')
            ?.addEventListener('input', () => renderBrowse());
      document.getElementById('filter-category')
            ?.addEventListener('change', () => renderBrowse());
      document.getElementById('filter-status')
            ?.addEventListener('change', () => renderBrowse());

      // ── Lost board filters ──
      document.getElementById('lost-search-input')
            ?.addEventListener('input', () => renderLostBoard());
      document.getElementById('lost-filter-category')
            ?.addEventListener('change', () => renderLostBoard());

      // ── Report found form ──
      document.getElementById('report-form')
            ?.addEventListener('submit', e => submitReport(e));
      document.getElementById('r-photo')
            ?.addEventListener('change', function () { handlePhotoUpload(this); });

      // ── Report lost form ──
      document.getElementById('report-lost-form')
            ?.addEventListener('submit', e => submitLostReport(e));
      document.getElementById('rl-photo')
            ?.addEventListener('change', function () { handleLostPhotoUpload(this); });

      // ── Modals — close buttons ──
      document.getElementById('btn-modal-close')
            ?.addEventListener('click', () => closeModal());
      document.getElementById('btn-claim-modal-close')
            ?.addEventListener('click', () => closeClaimModal());

      // ── Modals — click backdrop to close ──
      document.getElementById('item-modal')
            ?.addEventListener('click', e => {
                  if (e.target === document.getElementById('item-modal')) closeModal();
            });
      document.getElementById('claim-modal')
            ?.addEventListener('click', e => {
                  if (e.target === document.getElementById('claim-modal')) closeClaimModal();
            });

      // ── Claim submit ──
      document.getElementById('btn-submit-claim')
            ?.addEventListener('click', () => submitClaim());

      // ── Admin login ──
      document.getElementById('btn-admin-login')
            ?.addEventListener('click', () => adminLogin());
      document.getElementById('admin-password')
            ?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
      document.getElementById('admin-password')
            ?.addEventListener('input', () => {
                  document.getElementById('admin-pw-error').style.display = 'none';
            });

      // ── Admin tabs ──
      document.getElementById('tab-items')
            ?.addEventListener('click', function () { adminTab('items', this); });
      document.getElementById('tab-claims')
            ?.addEventListener('click', function () { adminTab('claims', this); });
      document.getElementById('tab-lost')
            ?.addEventListener('click', function () { adminTab('lost', this); });
}

bindEvents();
