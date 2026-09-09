// Show an actionable message even if an application dependency cannot load.
(async () => {
  try {
    if (!globalThis.XLSX?.read || !globalThis.XLSX?.utils) {
      throw new Error('Excel 라이브러리를 불러오지 못했습니다.');
    }
    await import('./main.js');
  } catch {
    const app = document.getElementById('app');
    const heading = document.createElement('h1');
    heading.textContent = '결보강 추천';
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = '프로그램을 불러오지 못했습니다. 새로고침해 주세요. 문제가 계속되면 저장소의 src 및 vendor 폴더가 index.html과 함께 배포되었는지 확인해 주세요.';
    app.replaceChildren(heading, message);
  }
})();
