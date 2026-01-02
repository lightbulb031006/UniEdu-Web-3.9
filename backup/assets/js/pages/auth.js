/**
 * auth page - login and register flows
 */

function renderAuth() {
    const main = document.querySelector('#main-content');
    if (!main) return;
    const user = window.UniAuth.getCurrentUser();
    if (user) {
        main.innerHTML = `
            <div class="card">
                <h2>Tài khoản</h2>
                <p class="text-muted">Đang đăng nhập: <strong>${user.email}</strong> • Vai trò: <strong>${user.role}</strong></p>
                <div class="mt-2">
                    <button class="btn" id="goDashboard">Vào Dashboard</button>
                    <button class="btn btn-danger" id="logoutNow">Đăng xuất</button>
                </div>
            </div>
        `;
        document.getElementById('goDashboard')?.addEventListener('click', () => window.UniUI.loadPage('dashboard'));
        document.getElementById('logoutNow')?.addEventListener('click', () => { window.UniAuth.logout(); window.UniUI.refreshNavigation(); window.UniUI.loadPage('home'); });
        return;
    }

    main.innerHTML = `
        ${window.UniAuth.getAuthFormsMarkup()}
    `;

    window.UniAuth.attachAuthFormHandlers(main);
}

window.AuthPage = { render: renderAuth };


