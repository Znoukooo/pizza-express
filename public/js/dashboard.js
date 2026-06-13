// ==========================================
// 1. KONFIGURASI KREDENSIAL & INITIALIZATION
// ==========================================
const LOCAL_URL = 'https://umidsquubznxdmlcelcl.supabase.co'; 
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWRzcXV1YnpueGRtbGNlbGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDcwNjAsImV4cCI6MjA5NjkyMzA2MH0.BJTpQFASv1A4f0SsidaYKTTB4RI3Zvax0HuLdJuE5ls';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const db = supabase.createClient(isLocal ? LOCAL_URL : window._env_?.SUPABASE_URL, isLocal ? LOCAL_KEY : window._env_?.SUPABASE_ANON_KEY);

let cart = {};
let currentCheckoutOrderId = null;
let menuData = [];
let isOrderActive = false;

document.addEventListener("DOMContentLoaded", async () => {
    await checkActiveOrder(); // Panggil pengecekan antrean terlebih dahulu
    await fetchMenu();
    // (Event listener checkout desktop dihapus karena form desktop sudah tidak ada)
});

// FUNGSI BARU: Mengecek apakah device ini punya tunggakan pesanan
async function checkActiveOrder() {
    const orderId = localStorage.getItem('latest_order_id');
    if (!orderId) return;

    try {
        // Ambil status pesanan terakhir dari database
        const { data: order, error } = await db.from('orders').select('status_pesanan').eq('id_order', orderId).single();
        if (error) return; // Abaikan jika pesanan ternyata sudah dihapus admin

        // Kunci keranjang JIKA pesanan BUKAN 'selesai' DAN BUKAN 'siap diambil'
        if (order.status_pesanan !== 'selesai' && order.status_pesanan !== 'siap diambil') {
            isOrderActive = true;
        } else {
            isOrderActive = false;
        }
    } catch (err) {
        console.error("Gagal mengecek status device:", err);
    }
}

async function fetchMenu() {
    const { data, error } = await db.from('menu').select('*').order('kategori', { ascending: true });
    if (error) return console.error(error);
    
    menuData = data;
    const container = document.getElementById('menu-container');
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
                <div class="col-md-6 col-lg-4 mb-4"> <div class="card h-100 shadow-sm border-0 rounded-3 overflow-hidden">
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
}

// -------------------------------------------------------------
// SISTEM KENDALI KERANJANG (ADD, MINUS, REMOVE)
// -------------------------------------------------------------
function addToCart(id) {
    // BLOK PENCEGAT: Hentikan fungsi jika ada pesanan aktif
    if (isOrderActive) {
        alert("Selesaikan atau ambil pesanan Anda sebelumnya terlebih dahulu sebelum memesan lagi!");
        cekStatusPesanan(); // Otomatis tampilkan progress antrean
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

// -------------------------------------------------------------
// RENDERING UI KERANJANG (SINKRONISASI MODAL MOBILE-FIRST)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// SISTEM NOTIFIKASI & NAVIGASI
// -------------------------------------------------------------
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

    // Selalu buka Modal Keranjang (Karena panel keranjang PC sudah dihilangkan)
    const modalEl = document.getElementById('modalMobileCart');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

// -------------------------------------------------------------
// SISTEM CHECKOUT (TERPUSAT UNTUK MOBILE MODAL)
// -------------------------------------------------------------
async function prosesCheckoutMobile() {
    const name = document.getElementById('mobile-customer-name').value;
    const type = document.getElementById('mobile-order-type').value;
    
    if (!name) return alert("Silakan ketik nama Anda terlebih dahulu di formulir pemesan!");
    
    // Tutup Modal Keranjang saat proses bayar
    const modalEl = document.getElementById('modalMobileCart');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    await submitOrderToDatabase(name, type);
}

// FUNGSI INTI MENYIMPAN TRANSAKSI
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
        
        // Simpan referensi ID pesanan untuk fungsi pelacakan & update lunas
        localStorage.setItem('latest_order_id', order.id_order);
        currentCheckoutOrderId = order.id_order; 
        
        // Kunci device setelah berhasil order
        isOrderActive = true; 

        const detailsPayload = Object.values(cart).map(item => ({
            id_order: order.id_order,
            id_menu: item.id_menu,
            jumlah: item.qty,
            subtotal: item.harga * item.qty
        }));

        const { error: detailErr } = await db.from('order_details').insert(detailsPayload);
        if (detailErr) throw detailErr;

        // Tampilkan Modal QRIS
        document.getElementById('customer-qris-total').innerText = `Rp ${totalPay.toLocaleString('id-ID')}`;
        document.getElementById('customer-qris-queue').innerText = `#${queueNum}`;
        const qrisModal = new bootstrap.Modal(document.getElementById('customerQrisModal'));
        qrisModal.show();

        // ---------------------------------------------------------
        // RESET KERANJANG AMAN DARI NULL
        // ---------------------------------------------------------
        cart = {};
        
        // Hanya reset input nama pada form mobile
        const mobileNameInput = document.getElementById('mobile-customer-name');
        if (mobileNameInput) mobileNameInput.value = '';
        
        updateCartDOM();

    } catch (err) {
        console.error("ERROR DATABASE/JS:", err);
        alert('Gagal mengirimkan pesanan: ' + (err.message || 'Cek inspect element console.'));
    }
}

// FUNGSI UPDATE STATUS LUNAS SAAT PELANGGAN KLIK SELESAI
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

// -------------------------------------------------------------
// SISTEM PELACAKAN PESANAN (LIVE TRACKING)
// -------------------------------------------------------------
async function cekStatusPesanan() {
    const orderId = localStorage.getItem('latest_order_id');
    
    if (!orderId) {
        alert("Belum ada pesanan yang tercatat di perangkat ini.");
        return;
    }

    try {
        const trackingEl = document.getElementById('modalLacakPesanan');
        const trackingModal = bootstrap.Modal.getInstance(trackingEl) || new bootstrap.Modal(trackingEl);
        trackingModal.show();
        
        document.getElementById('tracking-content').innerHTML = `<div class="spinner-border text-danger"></div><p class="mt-2 text-muted small">Memuat...</p>`;

        const { data: order, error } = await db.from('orders').select('*').eq('id_order', orderId).single();
        if (error) throw error;

        let statusText = '';
        let statusColor = '';
        let progress = 0;

        if (order.status_pesanan === 'menunggu konfirmasi') {
            statusText = '⏳ Menunggu Konfirmasi Kasir';
            statusColor = 'bg-warning text-dark';
            progress = 25;
        } else if (order.status_pesanan === 'dimasak') {
            statusText = '🍳 Sedang Dimasak Dapur';
            statusColor = 'bg-primary text-white';
            progress = 50;
        } else if (order.status_pesanan === 'mencari kurir' || order.status_pesanan === 'diantar') {
            statusText = '🛵 Sedang Diantar Kurir';
            statusColor = 'bg-info text-dark';
            progress = 75;
        } else if (order.status_pesanan === 'siap diambil' || order.status_pesanan === 'selesai') {
            // JIKA STATUS SUDAH "SIAP DIAMBIL" ATAU "SELESAI", KITA KOSONGKAN/TUTUP MODAL
            const modalEl = document.getElementById('modalLacakPesanan');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            // Opsional: Hapus ID dari localStorage agar pelanggan bisa pesan lagi
            if (order.status_pesanan === 'selesai') {
                localStorage.removeItem('latest_order_id');
                isOrderActive = false;
            }
            
            return; // Berhenti di sini, tidak perlu render konten ke modal
        }

        document.getElementById('tracking-content').innerHTML = `
            <div class="mb-3 border-bottom pb-3">
                <h4 class="fw-bold mb-0 text-danger">Antrian #${order.no_antrian}</h4>
            </div>
            
            <div class="badge ${statusColor} fs-6 px-4 py-2 mb-3 shadow-sm w-100">
                ${statusText}
            </div>
            
            <div class="progress mb-4" style="height: 22px;">
                <div class="progress-bar ${statusColor.split(' ')[0]}" style="width: ${progress}%;"></div>
            </div>

            ${(order.status_pesanan === 'menunggu konfirmasi') ? `
                <button class="btn btn-outline-danger btn-sm w-100 mb-4 fw-bold" onclick="batalkanPesanan()">❌ Batalkan Pesanan</button>
            ` : ''}
            
            <div class="p-3 bg-white border rounded text-start small">
                <div class="d-flex justify-content-between">
                    <span class="text-muted fw-bold">Total:</span>
                    <strong>Rp ${order.total_bayar.toLocaleString('id-ID')}</strong>
                </div>
            </div>
        `;

    } catch (err) {
        console.error(err);
        document.getElementById('tracking-content').innerHTML = `<div class="alert alert-danger small">Gagal memuat status pesanan.</div>`;
    }
}

// FUNGSI BARU: Membatalkan pesanan dari sisi pelanggan
async function batalkanPesanan() {
    const orderId = localStorage.getItem('latest_order_id');
    if (!orderId) return;

    if (confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
        try {
            // Hapus detail dan pesanan utama
            await db.from('order_details').delete().eq('id_order', orderId);
            await db.from('orders').delete().eq('id_order', orderId);
            
            // Reset status device
            localStorage.removeItem('latest_order_id');
            isOrderActive = false;
            
            // Tutup modal dan beri notifikasi
            const modalEl = document.getElementById('modalLacakPesanan');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            alert("Pesanan berhasil dibatalkan.");
            location.reload(); // Refresh agar tombol kembali aktif
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
            // Hapus detail dan pesanan utama di database
            await db.from('order_details').delete().eq('id_order', currentCheckoutOrderId);
            await db.from('orders').delete().eq('id_order', currentCheckoutOrderId);
            
            // Reset status device
            localStorage.removeItem('latest_order_id');
            isOrderActive = false;
            
            // Tutup modal
            const modalEl = document.getElementById('customerQrisModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            
            alert("Pesanan berhasil dibatalkan.");
            location.reload(); // Refresh halaman agar pelanggan bisa pesan lagi
        } catch (err) {
            console.error(err);
            alert("Gagal membatalkan pesanan.");
        }
    }
}