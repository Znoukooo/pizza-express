const LOCAL_URL = 'https://umidsquubznxdmlcelcl.supabase.co'; 
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWRzcXV1YnpueGRtbGNlbGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDcwNjAsImV4cCI6MjA5NjkyMzA2MH0.BJTpQFASv1A4f0SsidaYKTTB4RI3Zvax0HuLdJuE5ls';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const db = supabase.createClient(isLocal ? LOCAL_URL : window._env_?.SUPABASE_URL, isLocal ? LOCAL_KEY : window._env_?.SUPABASE_ANON_KEY);

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    const { data, error } = await db
        .from('users')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single();

    if (error || !data) {
        alert('Data kredensial salah atau tidak ditemukan!');
    } else {
        localStorage.setItem('staff_session', JSON.stringify(data));
        window.location.href = 'staff.html';
    }
});