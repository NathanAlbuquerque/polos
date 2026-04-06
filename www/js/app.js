// O Cordova dispara este evento quando o app está pronto
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Código específico nativo do Cordova (se necessário) vai aqui.
    console.log('Cordova está rodando!');
}

// Lógica de navegação
function navigateTo(screenId) {
    // Esconde todas as telas
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    // Mostra a tela desejada
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function navigateBack() {
    // Volta para a tela inicial
    navigateTo('home-screen');
}