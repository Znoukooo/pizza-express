// ==========================================
// 1. KONFIGURASI KREDENSIAL & INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://umidsquubznxdmlcelcl.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWRzcXV1YnpueGRtbGNlbGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDcwNjAsImV4cCI6MjA5NjkyMzA2MH0.BJTpQFASv1A4f0SsidaYKTTB4RI3Zvax0HuLdJuE5ls';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cart = {};
let currentCheckoutOrderId = null;
let menuData = [];
let isOrderActive = false;
let trackingSubscription = null;

document.addEventListener("DOMContentLoaded", async () => {
    await checkActiveOrder(); 
    await fetchMenu();
});

// FUNGSI: Mengecek apakah device ini punya tunggakan pesanan
async function checkActiveOrder() {
    const orderId = localStorage.getItem('latest_order_id');
    if (!orderId) return;

    try {
        const { data: order, error } = await db.from('orders').select('status_pesanan').eq('id_order', orderId).single();
        if (error) return; 

        if (order.status_pesanan !== 'selesai' && order.status_pesanan !== 'siap diambil') {
            isOrderActive = true;
        } else {
            isOrderActive = false;
        }
    } catch (err) {
        console.error("Gagal mengecek status device:", err);
    }
}

// FUNGSI: Ambil data menu kuliner
async function fetchMenu() {
    const container = document.getElementById('menu-container');
    try {
        const { data, error } = await db.from('menu').select('*').order('kategori', { ascending: true });
        if (error) throw error;
        
        menuData = data;
        container.innerHTML = '';

        const groupedMenu = data.reduce((acc, item) => {
            const cat = item.kategori || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});

        for (const [kategori, items] of Object.entries(groupedMenu)) {
            container.innerHTML += `<div class="col-12 mt-4 mb-3"><h4 class="category-divider fs-5">${kategori.toUpperCase()}</h4></div>`;
            
            items.forEach(item => {
                let defaultImage = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop';
                if (item.kategori === 'Minuman') defaultImage = 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=400&auto=format&fit=crop';
                else if (item.kategori === 'Snack') defaultImage = 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=400&auto=format&fit=crop';
                else if (item.kategori === 'Premium' || item.kategori === 'Signature') defaultImage = 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=400&auto=format&fit=crop';

                const finalImage = item.gambar_url ? item.gambar_url : defaultImage;

                container.innerHTML += `
                    <div class="col-md-6 col-lg-4 mb-4"> 
                        <div class="card h-100 shadow-sm border-0 rounded-3 overflow-hidden">
                            <div class="menu-img-container">
                                <img src="${finalImage}" alt="${item.nama_pizza}" class="menu-img" loading="lazy">
                            </div>
                            <div class="card-body p-3 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 class="fw-bold text-dark mb-1">${item.nama_pizza}</h6>
                                    <p class="text-danger fw-bold mb-0 small">Rp ${item.harga.toLocaleString('id-ID')}</p>
                                </div>
                                <button class="btn btn-sm btn-outline-danger w-100 rounded-pill mt-3 fw-bold" onclick="addToCart(${item.id_menu})">
                                    ➕ Masukkan Keranjang
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) {
        console.error("Gagal memuat menu:", err);
        container.innerHTML = `<div class="col-12 text-center text-danger py-5">Gagal mengambil data menu dari database.</div>`;
    }
}

// -------------------------------------------------------------
// SISTEM KENDALI KERANJANG (ADD, MINUS, REMOVE)
// -------------------------------------------------------------
function addToCart(id) {
    if (isOrderActive) {
        alert("Selesaikan atau ambil pesanan Anda sebelumnya terlebih dahulu sebelum memesan lagi!");
        cekStatusPesanan(); 
        return; 
    }

    const product = menuData.find(m => m.id_menu === id);
    if (cart[id]) cart[id].qty += 1;
    else cart[id] = { ...product, qty: 1 };
    
    updateCartDOM();
    showToast(product.nama_pizza);
}

function updateCartItem(id, delta) {
    if (!cart[id]) return;
    cart[id].qty += delta;
    if (cart[id].qty <= 0) {
        delete cart[id]; 
    }
    updateCartDOM();
}

function removeCartItem(id) {
    delete cart[id]; 
    updateCartDOM();
}

function updateCartDOM() {
    const mobContainer = document.getElementById('mobile-cart-items-list');
    const mobTotal = document.getElementById('mobile-modal-total-pay');
    const stickyBar = document.getElementById('mobile-sticky-cart');
    const stickyTotal = document.getElementById('mobile-cart-total');
    const stickyCount = document.getElementById('mobile-cart-count');
    const btnMobCheckout = document.getElementById('btn-checkout-mobile');

    let total = 0;
    let count = 0;
    let htmlContent = '';
    let itemsArray = Object.values(cart);

    if (itemsArray.length === 0) {
        mobContainer.innerHTML = '<p class="text-muted text-center py-4 mb-0 small">Belum ada menu yang dipilih.</p>';
        mobTotal.innerText = 'Rp 0';
        btnMobCheckout.disabled = true;
        stickyBar.style.setProperty('display', 'none', 'important'); 
        return;
    }

    stickyBar.style.setProperty('display', 'block', 'important'); 

    itemsArray.forEach(item => {
        let subtotal = item.harga * item.qty;
        total += subtotal;
        count += item.qty;
        
        htmlContent += `
            <div class="d-flex justify-content-between align-items-center mb-2 bg-white p-2 rounded border shadow-sm">
                <div class="flex-grow-1">
                    <h6 class="mb-1 fw-bold text-dark" style="font-size:13px; line-height: 1.2;">${item.nama_pizza}</h6>
                    <span class="text-danger fw-bold" style="font-size:12px;">Rp ${subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div class="d-flex align-items-center bg-light rounded-pill px-2 py-1 border">
                    <button class="btn btn-sm btn-link text-dark p-0 fw-bold" style="text-decoration: none;" onclick="updateCartItem(${item.id_menu}, -1)">➖</button>
                    <span class="mx-3 fw-bold small">${item.qty}</span>
                    <button class="btn btn-sm btn-link text-danger p-0 fw-bold" style="text-decoration: none;" onclick="updateCartItem(${item.id_menu}, 1)">➕</button>
                </div>
                <button class="btn btn-sm btn-link text-muted ms-2 p-0 fs-5" style="text-decoration: none;" onclick="removeCartItem(${item.id_menu})">🗑️</button>
            </div>
        `;
    });

    mobContainer.innerHTML = htmlContent;
    const formattedTotal = `Rp ${total.toLocaleString('id-ID')}`;
    mobTotal.innerText = formattedTotal;
    stickyTotal.innerText = formattedTotal;
    stickyCount.innerText = count;
    btnMobCheckout.disabled = false;
}

function showToast(namaProduk) {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
    const toastMessage = document.getElementById('toast-message');
    toastMessage.innerHTML = `<span class="text-danger">${namaProduk}</span> masuk!<br>Total pesanan: ${totalItems} Porsi`;

    const toastEl = document.getElementById('cartToast');
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

function scrollToCart() {
    const toastEl = document.getElementById('cartToast');
    const toast = bootstrap.Toast.getInstance(toastEl);
    if(toast) toast.hide();

    const modalEl = document.getElementById('modalMobileCart');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

async function prosesCheckoutMobile() {
    const name = document.getElementById('mobile-customer-name').value;
    const type = document.getElementById('mobile-order-type').value;
    
    if (!name) return alert("Silakan ketik nama Anda terlebih dahulu di formulir pemesan!");
    
    const modalEl = document.getElementById('modalMobileCart');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    await submitOrderToDatabase(name, type);
}

async function submitOrderToDatabase(customerName, orderType) {
    const totalPay = Object.values(cart).reduce((sum, item) => sum + (item.harga * item.qty), 0);
    const queueNum = Math.floor(Math.random() * 100) + 1;

    try {
        const { data: order, error: orderErr } = await db.from('orders').insert([{
            no_antrian: queueNum,
            nama_pelanggan: customerName,
            tipe_pesanan: orderType,
            total_bayar: totalPay,
            status_pembayaran: 'belum bayar', 
            status_pesanan: 'menunggu konfirmasi'
        }]).select().single();

        if (orderErr) throw orderErr;
        
        localStorage.setItem('latest_order_id', order.id_order);
        currentCheckoutOrderId = order.id_order; 
        isOrderActive = true; 

        const detailsPayload = Object.values(cart).map(item => ({
            id_order: order.id_order,
            id_menu: item.id_menu,
            jumlah: item.qty,
            subtotal: item.harga * item.qty
        }));

        const { error: detailErr } = await db.from('order_details').insert(detailsPayload);
        if (detailErr) throw detailErr;

        document.getElementById('customer-qris-total').innerText = `Rp ${totalPay.toLocaleString('id-ID')}`;
        document.getElementById('customer-qris-queue').innerText = `#${queueNum}`;
        const qrisModal = new bootstrap.Modal(document.getElementById('customerQrisModal'));
        qrisModal.show();

        cart = {};
        const mobileNameInput = document.getElementById('mobile-customer-name');
        if (mobileNameInput) mobileNameInput.value = '';
        updateCartDOM();

    } catch (err) {
        console.error("ERROR DATABASE/JS:", err);
        alert('Gagal mengirimkan pesanan: ' + (err.message || 'Cek inspect element console.'));
    }
}

async function selesaiDanLunas() {
    if (currentCheckoutOrderId) {
        try {
            await db.from('orders').update({ status_pembayaran: 'lunas' }).eq('id_order', currentCheckoutOrderId);
            cekStatusPesanan();
        } catch (err) {
            console.error("Gagal update status lunas:", err);
            cekStatusPesanan(); 
        }
    } else {
        cekStatusPesanan();
    }
}

// ==========================================
// 2. SISTEM PELACAKAN PESANAN (LIVE REALTIME)
// ==========================================
async function cekStatusPesanan() {
    const orderIdRaw = localStorage.getItem('latest_order_id');
    if (!orderIdRaw) {
        alert("Belum ada pesanan yang tercatat di perangkat ini.");
        return;
    }
    const orderId = parseInt(orderIdRaw);

    try {
        const trackingEl = document.getElementById('modalLacakPesanan');
        let trackingModal = bootstrap.Modal.getInstance(trackingEl);
        if (!trackingModal) {
            trackingModal = new bootstrap.Modal(trackingEl);
        }
        trackingModal.show();
        
        const contentContainer = document.getElementById('tracking-content');
        contentContainer.innerHTML = `<div class="spinner-border text-danger"></div><p class="mt-2 text-muted small">Menghubungkan ke dapur...</p>`;

        // Fungsi Render UI
        async function renderTrackingUI(order) {
            if (!order) {
                contentContainer.innerHTML = `
                    <div class="p-3 text-center">
                        <h5 class="text-muted fw-bold">Pesanan Selesai / Diakhiri ✨</h5>
                        <p class="text-muted small mb-0">Pesanan Anda sudah diselesaikan atau diarsip oleh dapur.</p>
                    </div>`;
                localStorage.removeItem('latest_order_id');
                isOrderActive = false;
                return;
            }

            let statusText = '';
            let statusColor = '';
            let progress = 0;

            if (order.status_pesanan === 'menunggu konfirmasi') {
                statusText = '⏳ Menunggu Konfirmasi Kasir';
                statusColor = 'bg-warning text-dark';
                progress = 25;
            } else if (order.status_pesanan === 'sedang diproses' || order.status_pesanan === 'dimasak') {
                statusText = '🍳 Sedang Dimasak Dapur';
                statusColor = 'bg-primary text-white';
                progress = 50;
            } else if (order.status_pesanan === 'mencari kurir' || order.status_pesanan === 'diantar') {
                statusText = '🛵 Sedang Diantar Kurir';
                statusColor = 'bg-info text-dark';
                progress = 75;
            } else if (order.status_pesanan === 'siap diambil' || order.status_pesanan === 'selesai') {
                statusText = '🍕 Pesanan Siap! Silakan Diambil';
                statusColor = 'bg-success text-white';
                progress = 100;
            }

            contentContainer.innerHTML = `
                <div class="mb-3 border-bottom pb-3">
                    <h4 class="fw-bold mb-0 text-danger">Antrian #${order.no_antrian}</h4>
                </div>
                <div class="badge ${statusColor} fs-6 px-4 py-2 mb-3 shadow-sm w-100">${statusText}</div>
                <div class="progress mb-4" style="height: 22px;">
                    <div class="progress-bar ${statusColor.split(' ')[0]}" style="width: ${progress}%;"></div>
                </div>
                ${(order.status_pesanan === 'menunggu konfirmasi') ? `
                    <button class="btn btn-outline-danger btn-sm w-100 mb-4 fw-bold" onclick="batalkanPesanan()">❌ Batalkan Pesanan</button>
                ` : ''}
                <div class="p-3 bg-white border rounded text-start small">
                    <div class="d-flex justify-content-between">
                        <span class="text-muted fw-bold">Total Belanja:</span>
                        <strong>Rp ${order.total_bayar.toLocaleString('id-ID')}</strong>
                    </div>
                </div>
            `;
        }

        // Ambil data snapshot awal
        const { data: ordersData, error: fetchError } = await db.from('orders').select('*').eq('id_order', orderId);
        if (fetchError) throw fetchError;

        if (!ordersData || ordersData.length === 0) {
            renderTrackingUI(null);
            return;
        }
        renderTrackingUI(ordersData[0]);

        // Berlangganan Realtime Channel Supabase
        if (trackingSubscription) {
            await db.removeChannel(trackingSubscription);
            trackingSubscription = null;
        }

        trackingSubscription = db.channel(`track-order-channel-${orderId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id_order=eq.${orderId}` }, 
            (payload) => {
                if (payload.eventType === 'DELETE') {
                    renderTrackingUI(null);
                } else if (payload.eventType === 'UPDATE') {
                    renderTrackingUI(payload.new);
                }
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') console.error('Koneksi Realtime gagal. Periksa Publication Supabase.');
            });

        // Event membersihkan channel saat modal ditutup pelanggan
        trackingEl.addEventListener('hidden.bs.modal', async () => {
            if (trackingSubscription) {
                await db.removeChannel(trackingSubscription);
                trackingSubscription = null;
            }
        }, { once: true });

    } catch (err) {
        console.error("DEBUG INTERNAL ERROR:", err);
        document.getElementById('tracking-content').innerHTML = `
            <div class="alert alert-danger small mb-0">Gagal memuat status pelacakan.</div>`;
    }
}

async function batalkanPesanan() {
    const orderId = localStorage.getItem('latest_order_id');
    if (!orderId) return;

    if (confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
        try {
            await db.from('order_details').delete().eq('id_order', orderId);
            await db.from('orders').delete().eq('id_order', orderId);
            
            localStorage.removeItem('latest_order_id');
            isOrderActive = false;
            
            const modalEl = document.getElementById('modalLacakPesanan');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            alert("Pesanan berhasil dibatalkan.");
            location.reload(); 
        } catch (err) {
            console.error(err);
            alert("Gagal membatalkan pesanan.");
        }
    }
}

async function batalkanPesananQRIS() {
    if (!currentCheckoutOrderId) return;

    if (confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
        try {
            await db.from('order_details').delete().eq('id_order', currentCheckoutOrderId);
            await db.from('orders').delete().eq('id_order', currentCheckoutOrderId);
            
            localStorage.removeItem('latest_order_id');
            isOrderActive = false;
            
            const modalEl = document.getElementById('customerQrisModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            alert("Pesanan berhasil dibatalkan.");
            location.reload(); 
        } catch (err) {
            console.error(err);
            alert("Gagal membatalkan pesanan.");
        }
    }
}