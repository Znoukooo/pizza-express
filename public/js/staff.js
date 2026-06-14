// ==========================================
// 1. KONFIGURASI KREDENSIAL & INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://umidsquubznxdmlcelcl.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWRzcXV1YnpueGRtbGNlbGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDcwNjAsImV4cCI6MjA5NjkyMzA2MH0.BJTpQFASv1A4f0SsidaYKTTB4RI3Zvax0HuLdJuE5ls';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentStaff = JSON.parse(localStorage.getItem('staff_session'));
let cart = []; 
let currentActiveDetailOrderId = null; 
let currentActiveDetailTotalPay = 0; 

// ==========================================
// 2. LIFECYCLE EVENT PLAYGROUND (DOM LOAD)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (!currentStaff) {
        alert("Akses ditolak! Silakan masuk sebagai staff.");
        window.location.href = 'login.html';
        return;
    }
    renderDashboardByRole();
    initModalEventListeners();
});

// ==========================================
// 3. CORE ROUTING DASHBOARD BY ROLE
// ==========================================
function renderDashboardByRole() {
    document.getElementById('user-display').innerText = `${currentStaff.username} (${currentStaff.role})`;
    document.getElementById('role-title').innerText = currentStaff.role.toUpperCase();
    document.querySelectorAll('.dynamic-view').forEach(el => el.classList.add('d-none'));

    if (currentStaff.role === 'kasir') {
        document.getElementById('view-kasir').classList.remove('d-none');
        loadKasirData();
    } else if (currentStaff.role === 'dapur') {
        document.getElementById('view-dapur').classList.remove('d-none');
        loadDapurData();
    } else if (currentStaff.role === 'kurir') {
        document.getElementById('view-kurir').classList.remove('d-none');
        loadKurirData();
    } else {
        document.getElementById('view-admin').classList.remove('d-none');
        loadAdminData();
        const addMenuForm = document.getElementById('add-menu-form');
        if (addMenuForm) addMenuForm.addEventListener('submit', handleAddMenu);
    }
}

// ==========================================
// 4. KASIR MODULE (DUAL TABLE & CART SYSTEM)
// ==========================================
async function loadKasirData() {
    if (document.getElementById('manual-menu-list')) {
        await prepareManualOrder();
    }
    
    const { data: orders, error } = await db.from('orders').select('*').order('id_order', { ascending: false });
    if (error) return console.error(error);

    const tbodyAktif = document.getElementById('kasir-orders-table');
    const tbodyRiwayat = document.getElementById('kasir-history-table');
    
    tbodyAktif.innerHTML = '';
    tbodyRiwayat.innerHTML = '';
    
    orders.forEach(o => {
        // Jika pesanan sudah LUNAS dan statusnya SELESAI, masuk ke RIWAYAT/ARSIP
        if (o.status_pembayaran === 'lunas' && (o.status_pesanan === 'selesai' || o.status_pesanan === 'sudah diambil')) {
            tbodyRiwayat.innerHTML += `
                <tr>
                    <td><strong>#${o.no_antrian}</strong></td>
                    <td>${o.nama_pelanggan}</td>
                    <td><span class="badge bg-secondary">${o.tipe_pesanan}</span></td>
                    <td>Rp ${o.total_bayar.toLocaleString('id-ID')}</td>
                    <td><span class="badge bg-success">LUNAS</span></td>
                    <td><span class="badge bg-secondary">SELESAI</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark fw-bold rounded-pill px-3" onclick="cetakStrukOtomatis(${o.id_order})">🖨️ Struk</button>
                    </td>
                </tr>
            `;
        } 
        else {
           // Ganti bagian penentuan actionBtn di dalam loop orders.forEach pada fungsi loadKasirData():
let actionBtn = '';

// KONDISI 1: Dine in / Takeaway yang sudah 'siap diambil' diselesaikan oleh Kasir menjadi 'sudah diambil'
if ((o.tipe_pesanan === 'dine in' || o.tipe_pesanan === 'takeaway') && o.status_pesanan === 'siap diambil') {
    actionBtn = `
        <button class="btn btn-sm btn-dark fw-bold rounded-pill px-2 shadow-sm me-1" onclick="bukaDetailPesanan(${o.id_order})">🔍 Detail</button>
        <button class="btn btn-sm btn-success fw-bold rounded-pill px-3 shadow-sm" onclick="updateStatus(${o.id_order}, 'sudah diambil')">🥡 Sudah Diambil</button>
    `;
} 
// KONDISI 2: Jika status_pesanan sudah 'sudah diambil' atau 'selesai' tapi belum masuk arsip utama
else if (o.status_pesanan === 'sudah diambil' || o.status_pesanan === 'selesai') {
    actionBtn = `
        <button class="btn btn-sm btn-outline-dark fw-bold rounded-pill px-3" onclick="cetakStrukOtomatis(${o.id_order})">🖨️ Struk</button>
    `;
}
// KONDISI 3: Jika pembayaran lunas tapi masih menunggu konfirmasi awal dari kasir untuk dikirim ke dapur
else if (o.status_pembayaran === 'lunas' && o.status_pesanan === 'menunggu konfirmasi') {
    actionBtn = `<button class="btn btn-sm btn-danger rounded-pill px-3 shadow-sm" onclick="updateStatus(${o.id_order}, 'dimasak')">Kirim ke Dapur</button>`;
} 
// Kondisi default lainnya (sedang dimasak, dikirim, dll)
else {
    actionBtn = `
        <button class="btn btn-sm btn-dark fw-bold rounded-pill px-2 shadow-sm me-1" onclick="bukaDetailPesanan(${o.id_order})">🔍 Detail</button>
        <button class="btn btn-sm btn-outline-danger fw-bold rounded-pill px-2 shadow-sm" onclick="hapusPesanan(${o.id_order})">🗑️ Hapus</button>
    `;
}

            tbodyAktif.innerHTML += `
                <tr>
                    <td><strong>#${o.no_antrian}</strong></td>
                    <td>${o.nama_pelanggan}</td>
                    <td><span class="badge bg-secondary">${o.tipe_pesanan}</span></td>
                    <td>Rp ${o.total_bayar.toLocaleString('id-ID')}</td>
                    <td><span class="badge ${o.status_pembayaran === 'lunas' ? 'bg-success' : 'bg-danger'}">${o.status_pembayaran.toUpperCase()}</span></td>
                    <td><span class="badge bg-dark">${o.status_pesanan}</span></td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }
    });

    if (tbodyAktif.innerHTML === '') {
        tbodyAktif.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada antrian transaksi aktif.</td></tr>`;
    }
    if (tbodyRiwayat.innerHTML === '') {
        tbodyRiwayat.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Belum ada riwayat transaksi selesai hari ini.</td></tr>`;
    }
}

async function prepareManualOrder() {
    const { data: menu } = await db.from('menu').select('*').order('kategori', { ascending: true });
    const container = document.getElementById('manual-menu-list');
    if (!container) return;

    const grouped = menu.reduce((acc, item) => {
        const cat = item.kategori || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    let html = '';
    for (const [kategori, items] of Object.entries(grouped)) {
        html += `<div class="bg-light p-2 mt-2 fw-bold text-danger border-bottom small">${kategori.toUpperCase()}</div>`;
        items.forEach(m => {
            html += `
                <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center small py-1" 
                        onclick="addToCart(${m.id_menu}, '${m.nama_pizza}', ${m.harga})">
                    <span>${m.nama_pizza}</span> 
                    <span class="text-muted">Rp ${m.harga.toLocaleString('id-ID')}</span>
                </button>
            `;
        });
    }
    container.innerHTML = html;
}

function addToCart(id, nama, harga) {
    cart.push({ id, nama, harga });
    renderCart();
}

function renderCart() {
    const cartEl = document.getElementById('cart-items');
    if (!cartEl) return;
    
    const total = cart.reduce((sum, item) => sum + item.harga, 0);
    
    if (cart.length === 0) {
        cartEl.innerHTML = '<p class="text-muted text-center py-2 mb-0 small">Keranjang belanja kosong.</p>';
        document.getElementById('cart-total').innerText = 'Rp 0';
        return;
    }

    cartEl.innerHTML = cart.map((item, index) => `
        <div class="d-flex justify-content-between align-items-center mb-1 bg-white border p-2 rounded shadow-sm">
            <span class="fw-bold text-dark" style="font-size: 12px;">${item.nama}</span>
            <span class="font-monospace text-muted" style="font-size: 12px;">
                Rp ${item.harga.toLocaleString('id-ID')} 
                <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2 fw-bold" onclick="removeFromCart(${index})" style="text-decoration:none;">✕</button>
            </span>
        </div>
    `).join('');
    
    document.getElementById('cart-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

async function prosesPesananCart() {
    const nama = document.getElementById('manual-name').value;
    const tipe = document.getElementById('manual-type').value;
    const metodePembayaran = document.getElementById('manual-payment').value; 
    
    if (!nama) return alert("Silakan masukkan nama pelanggan terlebih dahulu!");
    if (cart.length === 0) return alert("Keranjang belanja kasir masih kosong!");

    const total = cart.reduce((sum, item) => sum + item.harga, 0);
    const queueNum = Math.floor(Math.random() * 99) + 1;

    const statusBayar = metodePembayaran === 'tunai' ? 'lunas' : 'belum bayar';
    const statusOrder = metodePembayaran === 'tunai' ? 'dimasak' : 'menunggu konfirmasi';

    try {
        const { data: order, error: orderErr } = await db.from('orders').insert([{
            no_antrian: queueNum,
            nama_pelanggan: nama,
            tipe_pesanan: tipe,
            total_bayar: total,
            status_pembayaran: statusBayar, 
            status_pesanan: statusOrder   
        }]).select().single();

        if (orderErr) throw orderErr;

        const detailsPayload = cart.map(item => ({ 
            id_order: order.id_order, 
            id_menu: item.id, 
            jumlah: 1, 
            subtotal: item.harga 
        }));
        
        const { error: detailErr } = await db.from('order_details').insert(detailsPayload);
        if (detailErr) throw detailErr;

        cart = []; 
        document.getElementById('manual-name').value = '';
        renderCart();
        
        const modalInputEl = document.getElementById('modalInputManual');
        const modalInput = bootstrap.Modal.getInstance(modalInputEl) || new bootstrap.Modal(modalInputEl);
        modalInput.hide();
        
        if (metodePembayaran === 'tunai') {
            await cetakStrukOtomatis(order.id_order);
            setTimeout(loadKasirData, 300);
        } else {
            currentActiveDetailOrderId = order.id_order;
            document.getElementById('qris-price-display').innerText = `Rp ${total.toLocaleString('id-ID')}`;
            
            const modalQrisEl = document.getElementById('modalQrisGopay');
            const modalQris = bootstrap.Modal.getInstance(modalQrisEl) || new bootstrap.Modal(modalQrisEl);
            modalQris.show();
        }

    } catch (err) {
        console.error(err);
        alert("Gagal memproses pembuatan pesanan manual kasir.");
    }
}

async function hapusPesanan(id) {
    if (confirm("Apakah Anda yakin ingin membatalkan dan menghapus permanen data pesanan ini?")) {
        try {
            await db.from('order_details').delete().eq('id_order', id);
            const { error } = await db.from('orders').delete().eq('id_order', id);
            if (error) throw error;
            setTimeout(loadKasirData, 300);
        } catch (err) {
            console.error(err);
            alert("Gagal menghapus pesanan.");
        }
    }
}

// ==========================================
// 5. DETAIL PESANAN & KALKULATOR MODAL MODUL
// ==========================================
async function bukaDetailPesanan(orderId) {
    currentActiveDetailOrderId = orderId;
    document.getElementById('cash-received').value = '';
    document.getElementById('cash-change').value = 'Rp 0';

    try {
        const { data: order, error: orderErr } = await db.from('orders').select('*').eq('id_order', orderId).single();
        if (orderErr) throw orderErr;

        currentActiveDetailTotalPay = order.total_bayar;

        document.getElementById('detail-modal-title').innerText = `Detail Pesanan #${order.no_antrian}`;
        document.getElementById('detail-customer-info').innerText = `${order.nama_pelanggan} (${order.tipe_pesanan.toUpperCase()})`;
        document.getElementById('detail-total-display').innerText = `Rp ${order.total_bayar.toLocaleString('id-ID')}`;

        const { data: details, error: detailErr } = await db.from('order_details').select('*, menu(*)').eq('id_order', orderId);
        if (detailErr) throw detailErr;

        const itemsContainer = document.getElementById('detail-items-container');
        itemsContainer.innerHTML = '';
        
        details.forEach(item => {
            const namaPizza = item.menu ? item.menu.nama_pizza : 'Menu Dihapus';
            itemsContainer.innerHTML += `
                <div class="d-flex justify-content-between align-items-center mb-1 small text-dark border-bottom pb-1">
                    <span><strong>${item.jumlah}x</strong> ${namaPizza}</span>
                    <span class="font-monospace">Rp ${item.subtotal.toLocaleString('id-ID')}</span>
                </div>
            `;
        });

        if (order.status_pembayaran === 'lunas') {
            document.getElementById('area-aksi-pembayaran').classList.add('d-none');
            document.getElementById('area-aksi-lunas').classList.remove('d-none');
        } else {
            document.getElementById('area-aksi-pembayaran').classList.remove('d-none');
            document.getElementById('area-aksi-lunas').classList.add('d-none');
            const firstTab = new bootstrap.Tab(document.getElementById('cash-tab'));
            firstTab.show();
        }

        const modalDetail = new bootstrap.Modal(document.getElementById('modalDetailPesanan'));
        modalDetail.show();

    } catch (err) {
        console.error(err);
        alert("Gagal memuat rincian data pesanan dari database.");
    }
}

function hitungKembalian() {
    const uangDiterima = parseInt(document.getElementById('cash-received').value) || 0;
    const kembalianDOM = document.getElementById('cash-change');

    if (uangDiterima < currentActiveDetailTotalPay) {
        kembalianDOM.value = "Uang Kurang";
        kembalianDOM.classList.replace('text-success', 'text-danger');
    } else {
        const selisih = uangDiterima - currentActiveDetailTotalPay;
        kembalianDOM.value = `Rp ${selisih.toLocaleString('id-ID')}`;
        kembalianDOM.classList.replace('text-danger', 'text-success');
    }
}

async function prosesPelunasanOrder(metode) {
    if (!currentActiveDetailOrderId) return;

    if (metode === 'Cash') {
        const uangDiterima = parseInt(document.getElementById('cash-received').value) || 0;
        if (uangDiterima < currentActiveDetailTotalPay) {
            alert("Uang yang diterima kurang dari total tagihan pesanan!");
            return;
        }
    }

    try {
        const { error } = await db.from('orders').update({
            status_pembayaran: 'lunas',
            status_pesanan: 'dimasak'
        }).eq('id_order', currentActiveDetailOrderId);

        if (error) throw error;

        const modalEl = document.getElementById('modalDetailPesanan');
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.hide();

        await cetakStrukOtomatis(currentActiveDetailOrderId);
        setTimeout(loadKasirData, 300);

    } catch (err) {
        console.error(err);
        alert("Gagal memproses pelunasan di database.");
    }
}

// ==========================================
// 6. INITIALIZE MODAL BINDING HANDLERS
// ==========================================
function initModalEventListeners() {
    const btnLunasCash = document.getElementById('btn-lunas-cash');
    if (btnLunasCash) btnLunasCash.addEventListener('click', () => prosesPelunasanOrder('Cash'));

    const btnLunasQrisDetail = document.getElementById('btn-lunas-qris');
    if (btnLunasQrisDetail) btnLunasQrisDetail.addEventListener('click', () => prosesPelunasanOrder('QRIS'));

    const btnCetakUlang = document.getElementById('btn-cetak-ulang-struk');
    if (btnCetakUlang) {
        btnCetakUlang.addEventListener('click', () => {
            if (currentActiveDetailOrderId) cetakStrukOtomatis(currentActiveDetailOrderId);
        });
    }

    const btnKonfirmasiQris = document.getElementById('btn-konfirmasi-qris');
    if (btnKonfirmasiQris) {
        btnKonfirmasiQris.addEventListener('click', async () => {
            if (!currentActiveDetailOrderId) return;

            const { error } = await db.from('orders').update({
                status_pembayaran: 'lunas',
                status_pesanan: 'dimasak'
            }).eq('id_order', currentActiveDetailOrderId);

            if (!error) {
                const modalQrisEl = document.getElementById('modalQrisGopay');
                const modalQris = bootstrap.Modal.getInstance(modalQrisEl) || new bootstrap.Modal(modalQrisEl);
                modalQris.hide();

                await cetakStrukOtomatis(currentActiveDetailOrderId);
                setTimeout(loadKasirData, 300); 
            } else {
                alert("Gagal memperbarui status verifikasi pembayaran.");
            }
        });
    }
}

// ==========================================
// 7. STRUK MANAGEMENT (OUTPUT RENDERER)
// ==========================================
async function cetakStrukOtomatis(orderId) {
    const { data: order } = await db.from('orders').select('*').eq('id_order', orderId).single();
    const { data: details } = await db.from('order_details').select('*, menu(*)').eq('id_order', orderId);

    if (!order) return;

    const content = document.getElementById('struk-content');
    let itemRows = '';
    
    details.forEach(d => {
        itemRows += `
        <div class="d-flex justify-content-between">
            <span>${d.menu ? d.menu.nama_pizza : 'Menu Dihapus'} (x${d.jumlah})</span>
            <span>Rp ${d.subtotal.toLocaleString('id-ID')}</span>
        </div>`;
    });

    content.innerHTML = `
        <div class="text-center mb-3">
            <h5 class="fw-bold mb-0">PIZZA EXPRESS</h5>
            <small class="text-muted">Managed by Znoukooo</small>
        </div>
        <hr class="border-dashed">
        <div>
            <strong>No Antrian: #${order.no_antrian}</strong><br>
            Pelanggan: ${order.nama_pelanggan}<br>
            Tipe: ${order.tipe_pesanan.toUpperCase()}<br>
            Waktu: ${new Date(order.waktu_pesan).toLocaleTimeString('id-ID')}
        </div>
        <hr class="border-dashed">
        ${itemRows}
        <hr class="border-dashed">
        <div class="d-flex justify-content-between fw-bold fs-6">
          <span>TOTAL:</span>
          <span>Rp ${order.total_bayar.toLocaleString('id-ID')}</span>
        </div>
        <div class="text-center text-success fw-bold small mt-3">
           -- LUNAS - THANK YOU --
        </div>
    `;

    const modalStruk = new bootstrap.Modal(document.getElementById('modalStruk'));
    modalStruk.show();
}

// ==========================================
// 8. KITCHEN & COURIER LOGISTICS CHANNELS
// ==========================================
async function loadDapurData() {
    const { data: orders, error } = await db
        .from('orders')
        .select(`
            *,
            order_details (
                jumlah,
                subtotal,
                menu (nama_pizza)
            )
        `)
        .in('status_pesanan', ['dimasak', 'sedang diproses'])
        .order('waktu_pesan', { ascending: true });

    if (error) {
        console.error("Gagal memuat data dapur:", error);
        return;
    }

    const container = document.getElementById('dapur-orders-container');
    const badgeCount = document.getElementById('dapur-queue-count');
    
    if (container && badgeCount) {
        badgeCount.innerText = `${orders.length} Pesanan Aktif`;

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h5 class="text-muted fw-bold">Dapur Sedang Kosong 🧹</h5>
                    <p class="text-muted small">Belum ada pesanan masuk dari kasir.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        orders.forEach((o, index) => {
            let borderClass = 'border-secondary';
            let priorityBadge = '';
            
            if (index === 0) {
                borderClass = 'border-danger border-2 shadow';
                priorityBadge = `<span class="badge bg-danger ms-2 shadow-sm animate-pulse">PRIORITAS UTAMA</span>`;
            }

            let detailsHtml = '<ul class="list-group list-group-flush mb-3 small font-monospace">';
            if (o.order_details && o.order_details.length > 0) {
                o.order_details.forEach(detail => {
                    const namaMenu = detail.menu ? detail.menu.nama_pizza : 'Menu Dihapus';
                    detailsHtml += `<li class="list-group-item px-2 py-1 bg-transparent border-0 border-bottom"><strong>${detail.jumlah}x</strong> ${namaMenu}</li>`;
                });
            } else {
                detailsHtml += `<li class="list-group-item text-danger px-2 py-1 border-0">Data rincian kosong.</li>`;
            }
            detailsHtml += '</ul>';

            // Cari penentuan actionButtons di dalam loop orders.forEach pada fungsi loadDapurData():
let actionButtons = '';
if (o.status_pesanan === 'dimasak') {
    actionButtons = `
        <div class="d-flex gap-2">
            <button class="btn btn-warning btn-sm w-100 fw-bold shadow-sm" onclick="terimaPesananDapur(${o.id_order})">👨‍🍳 Mulai Masak</button>
        </div>
    `;
} else if (o.status_pesanan === 'sedang diproses') {
    // Seluruh tipe pesanan (delivery, dine in, takeaway) diarahkan ke 'siap diambil' saat beres dimasak
    actionButtons = `
        <div class="d-flex gap-2">
            <button class="btn btn-success btn-sm w-100 fw-bold shadow-sm" onclick="updateStatus(${o.id_order}, 'siap diambil')">✅ Selesai Masak</button>
        </div>
    `;
}

            const deleteButton = `
                <button class="btn btn-outline-danger btn-sm px-2 py-0 border-0" title="Hapus Pesanan Ini" onclick="hapusPesananDapur(${o.id_order})">🗑️</button>
            `;

            container.innerHTML += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card ${borderClass} h-100">
                        <div class="card-header bg-white d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-0 fw-bold text-dark d-inline-block">#${o.no_antrian}</h5>
                                ${priorityBadge}
                            </div>
                            ${deleteButton}
                        </div>
                        <div class="card-body bg-light pb-2">
                            <p class="mb-2 text-muted small">
                                Pelanggan: <strong class="text-dark">${o.nama_pelanggan}</strong><br>
                                Layanan: <span class="badge bg-dark">${o.tipe_pesanan.toUpperCase()}</span>
                            </p>
                            ${detailsHtml}
                        </div>
                        <div class="card-footer bg-white border-0 pt-0 pb-3">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
        });
    }
}

async function terimaPesananDapur(id) {
    const { error } = await db.from('orders')
        .update({ status_pesanan: 'sedang diproses' })
        .eq('id_order', id);

    if (error) {
        alert("Gagal memperbarui status pesanan: " + error.message);
    } else {
        loadDapurData();
    }
}

async function hapusPesananDapur(id) {
    if (confirm("🚨 PERINGATAN: Apakah Anda yakin ingin MENGHAPUS pesanan ini dari antrean dapur? Tindakan ini tidak dapat dibatalkan!")) {
        try {
            await db.from('order_details').delete().eq('id_order', id);
            const { error } = await db.from('orders').delete().eq('id_order', id);
            
            if (error) throw error;
            loadDapurData(); 
        } catch (err) {
            console.error(err);
            alert("Gagal menghapus pesanan dari database.");
        }
    }
}

// Ganti fungsi loadKurirData() di dalam staff.js dengan ini:
async function loadKurirData() {
    // Kurir memantau pesanan delivery yang 'siap diambil' (siap diantar) atau yang sedang dalam status 'dikirim'
    const { data: orders, error } = await db.from('orders')
        .select('*')
        .eq('tipe_pesanan', 'delivery')
        .in('status_pesanan', ['siap diambil', 'dikirim', 'diantar']);
        
    if (error) return console.error(error);

    const container = document.getElementById('kurir-orders-container');
    if (container) {
        container.innerHTML = orders.length === 0 ? '<p class="text-muted text-center p-3">Belum ada pizza delivery aktif.</p>' : '';
        orders.forEach(o => {
            let actionBtn = '';
            
            if (o.status_pesanan === 'siap diambil') {
                actionBtn = `<button class="btn btn-sm btn-info text-white fw-bold px-3 shadow-sm" onclick="updateStatus(${o.id_order}, 'dikirim')">🛵 Ambil & Antar Pesanan</button>`;
            } else if (o.status_pesanan === 'dikirim') {
                actionBtn = `<span class="badge bg-warning text-dark py-2 px-3">⌛ Menunggu Konfirmasi Pelanggan</span>`;
            }
            
            container.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center mb-2 rounded border shadow-sm p-3 bg-white">
                    <div>
                        <strong class="text-danger">#${o.no_antrian} - ${o.nama_pelanggan}</strong> 
                        <div class="small text-muted mt-1">Status saat ini: <span class="badge bg-dark">${o.status_pesanan.toUpperCase()}</span></div>
                    </div>
                    ${actionBtn}
                </div>
            `;
        });
    }
}

// ==========================================
// 9. BACK-OFFICE ADMIN MODULE
// ==========================================
async function loadAdminData() {
    const { data: menu, error } = await db.from('menu').select('*').order('id_menu', { ascending: true });
    if (error) return console.error(error);
    
    const container = document.getElementById('admin-categories-container');
    if (!container) return;
    
    container.innerHTML = ''; 

    if (!menu || menu.length === 0) {
        container.innerHTML = `
            <div class="card shadow-sm border-0 rounded-3 p-4 text-center text-muted small">
                📦 Belum ada data menu kuliner yang terdaftar di database.
            </div>`;
        return;
    }

    const groupedMenu = menu.reduce((acc, item) => {
        const cat = item.kategori || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    for (const [kategori, items] of Object.entries(groupedMenu)) {
        let tableRows = '';
        
        items.forEach(m => {
            const finalThumb = m.gambar_url ? m.gambar_url : 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=80';
            tableRows += `
                <tr>
                    <td style="width: 80px;"><span class="text-muted font-monospace small">#${m.id_menu}</span></td>
                    <td style="width: 70px;"><img src="${finalThumb}" alt="thumb" class="admin-thumb shadow-sm border"></td>
                    <td>
                        <strong class="text-dark d-block">${m.nama_pizza}</strong>
                        <button class="btn btn-link text-primary p-0 small shadow-none" style="font-size: 11px; text-decoration: none;" onclick="bukaModalGantiGambar(${m.id_menu})">📸 Ganti Gambar</button>
                    </td>
                    <td><span class="font-monospace text-danger fw-semibold">Rp ${m.harga.toLocaleString('id-ID')}</span></td>
                    <td class="text-center" style="width: 100px;">
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 small" onclick="deleteMenu(${m.id_menu})">Hapus</button>
                    </td>
                </tr>
            `;
        });

        container.innerHTML += `
            <div class="card shadow-sm border-0 rounded-3 mb-4 overflow-hidden">
                <div class="card-header bg-dark text-warning fw-bold py-2 d-flex justify-content-between align-items-center">
                    <span style="font-size: 14px;">📂 KATEGORI: ${kategori.toUpperCase()}</span>
                    <span class="badge bg-secondary font-monospace" style="font-size: 11px;">${items.length} Item</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" style="font-size: 13px;">
                            <thead class="table-light">
                                <tr><th>ID</th><th>Foto</th><th>Nama Menu</th><th>Harga</th><th class="text-center">Aksi</th></tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
}

function bukaModalGantiGambar(idMenu) {
    document.getElementById('edit-menu-id').value = idMenu;
    document.getElementById('edit-pizza-image').value = ''; 
    const modalEdit = new bootstrap.Modal(document.getElementById('modalEditGambar'));
    modalEdit.show();
}

const editGambarForm = document.getElementById('edit-gambar-form');
if (editGambarForm) {
    editGambarForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnUpdate = document.getElementById('btn-update-gambar');
        const idMenu = document.getElementById('edit-menu-id').value;
        const fileInput = document.getElementById('edit-pizza-image');
        const file = fileInput.files[0];

        if (!file) return alert("Pilih file gambar baru terlebih dahulu!");

        btnUpdate.innerText = "⏳ Mengunggah...";
        btnUpdate.disabled = true;

        try {
            const cleanFileName = `update_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: uploadErr } = await db.storage
                .from('menu-image')
                .upload(cleanFileName, file);

            if (uploadErr) throw uploadErr;

            const responseGethUrl = db.storage
                .from('menu-image')
                .getPublicUrl(cleanFileName);

            const newPublicUrl = responseGethUrl.data.publicUrl; 

            const { error: dbErr } = await db.from('menu')
                .update({ gambar_url: newPublicUrl })
                .eq('id_menu', idMenu);

            if (dbErr) throw dbErr;

            const modalEl = document.getElementById('modalEditGambar');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            alert("⚡ Gambar menu berhasil diperbarui!");
            loadAdminData(); 

        } catch (err) {
            console.error(err);
            alert("Gagal memperbarui gambar: " + err.message);
        } finally {
            btnUpdate.innerText = "⚡ Unggah & Perbarui";
            btnUpdate.disabled = false;
        }
    });
}

async function handleAddMenu(e) {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btn-submit-menu');
    const name = document.getElementById('admin-pizza-name').value;
    const price = parseInt(document.getElementById('admin-pizza-price').value);
    const cat = document.getElementById('admin-pizza-category').value;
    const fileInput = document.getElementById('admin-pizza-image');
    const file = fileInput.files[0];

    if (!file) return alert("Silakan pilih file gambar terlebih dahulu!");

    btnSubmit.innerText = "⏳ Menyimpan & Mengunggah...";
    btnSubmit.disabled = true;

    try {
        const cleanFileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error: uploadErr } = await db.storage
            .from('menu-image') 
            .upload(cleanFileName, file);

        if (uploadErr) throw uploadErr;

        const { data: publicURLData } = db.storage
            .from('menu-image')
            .getPublicUrl(cleanFileName);

        const finalPublicUrl = publicURLData.publicUrl;

        const { error: dbErr } = await db.from('menu').insert([
            { nama_pizza: name, harga: price, kategori: cat, gambar_url: finalPublicUrl }
        ]);

        if (dbErr) throw dbErr;

        document.getElementById('add-menu-form').reset();
        alert("🎉 Menu baru & foto produk berhasil disimpan!");
        loadAdminData();

    } catch (err) {
        console.error(err);
        alert("Gagal memproses unggahan menu: " + err.message);
    } finally {
        btnSubmit.innerText = "Simpan Menu";
        btnSubmit.disabled = false;
    }
}

async function deleteMenu(id) {
    if (confirm('Hapus menu ini?')) {
        await db.from('menu').delete().eq('id_menu', id);
        loadAdminData();
    }
}

// ==========================================
// 10. SYSTEM UTILITIES (STATUS CHANGER & LOGOUT)
// ==========================================
async function updateStatus(id, newStatus) {
    let eventTarget = null;
    let originalText = '';

    try {
        if (window.event && window.event.target && window.event.target.tagName === 'BUTTON') {
            eventTarget = window.event.target;
            originalText = eventTarget.innerText;
            eventTarget.innerText = '⏳ Memproses...';
            eventTarget.disabled = true;
        }
    } catch (e) {
        // Abaikan error target
    }

    try {
        const { error } = await db.from('orders').update({ 
            status_pesanan: newStatus,
            status_pembayaran: 'lunas'
        }).eq('id_order', id);
        
        if (error) throw error;

        setTimeout(() => {
            if (currentStaff.role === 'kasir') {
                loadKasirData();
            } else if (currentStaff.role === 'dapur') {
                loadDapurData(); 
            } else if (currentStaff.role === 'kurir') {
                loadKurirData();
            }
        }, 150); 

    } catch (err) {
        console.error("Gagal update status:", err);
        alert("Gagal mengubah status pesanan. Pastikan koneksi stabil.");
        
        if (eventTarget) {
            eventTarget.innerText = originalText;
            eventTarget.disabled = false;
        }
    }
}

function logout() {
    localStorage.removeItem('staff_session');
    window.location.href = 'login.html';
}