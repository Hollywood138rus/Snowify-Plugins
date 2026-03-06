// ─── Internet Radio Plugin for Snowify ───
// Self-contained plugin: fetches radio-browser.info API, manages own audio,
// injects nav button + view via DOM, integrates with NP bar via observers.
(function () {
  'use strict';

  // Guard against double-load
  if (window._snowifyRadioLoaded) return;
  window._snowifyRadioLoaded = true;

  // ═══════ Constants ═══════
  const API = 'https://de1.api.radio-browser.info';
  const GEO_URL = 'http://ip-api.com/json/?fields=country,countryCode,city';
  const VOLUME_SCALE = 0.3;
  const SEARCH_DEBOUNCE = 400;
  const PLAY_TIMEOUT = 25000;
  const SCROLL_DISTANCE = 400;
  const STORAGE_KEY = 'snowify_radio';
  const LIVE_BADGE = 'LIVE';

  const FALLBACK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const FALLBACK_SVG = '<svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-subdued)"><path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM6 8a2 2 0 1 1 2.5 1.937V15.5a.5.5 0 0 1-1 0V9.937A2 2 0 0 1 6 8"/></svg>';
  const NAV_ICON_SVG = '<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM6 8a2 2 0 1 1 2.5 1.937V15.5a.5.5 0 0 1-1 0V9.937A2 2 0 0 1 6 8"/></svg>';
  const GENRE_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393', '#00cec9', '#fd79a8', '#6c5ce7', '#00b894'];

  // ═══════ i18n ═══════
  const TRANSLATIONS = {
    en: {
      'nav.radio': 'Radio',
      'radio.title': 'Radio',
      'radio.searchStations': 'Search stations',
      'radio.searchPlaceholder': 'Search radio stations...',
      'radio.yourStations': 'Your Stations',
      'radio.popularInCity': 'Popular in {{city}}, {{country}}',
      'radio.popularInCountry': 'Popular in {{country}}',
      'radio.popularStations': 'Popular Stations',
      'radio.trendingIn': 'Trending in {{country}}',
      'radio.trendingWorldwide': 'Trending Worldwide',
      'radio.yourCountry': 'Your Country',
      'radio.browseByTag': 'Browse by Tag',
      'radio.allTagStations': 'All "{{tag}}" Stations',
      'radio.allResults': 'All Results',
      'radio.resultsFor': 'Results for "{{query}}"',
      'radio.noStationsFor': 'No stations found for "{{query}}".',
      'radio.couldNotLoad': 'Could not load radio stations.',
      'radio.liveRadio': 'Live Radio',
      'radio.noQueue': 'Live Radio — no queue',
      'player.play': 'Play',
      'toast.radioNoStreamUrl': 'No stream URL for this station',
      'toast.radioTuningIn': 'Tuning in: {{name}}',
      'toast.radioUnavailable': 'Station unavailable — try another',
      'toast.radioStationRemoved': 'Removed: {{name}}',
      'toast.radioStationAdded': 'Added: {{name}}',
      'toast.radioStreamEnded': 'Radio stream ended — try another station',
      'toast.radioStreamLost': 'Radio stream lost — try another station',
      'toast.radioStreamStalled': 'Radio stream stalled — try another station',
    },
    es: {
      'nav.radio': 'Radio',
      'radio.title': 'Radio',
      'radio.searchStations': 'Buscar estaciones',
      'radio.searchPlaceholder': 'Buscar estaciones de radio...',
      'radio.yourStations': 'Tus estaciones',
      'radio.popularInCity': 'Popular en {{city}}, {{country}}',
      'radio.popularInCountry': 'Popular en {{country}}',
      'radio.popularStations': 'Estaciones populares',
      'radio.trendingIn': 'Tendencia en {{country}}',
      'radio.trendingWorldwide': 'Tendencia mundial',
      'radio.yourCountry': 'Tu país',
      'radio.browseByTag': 'Explorar por etiqueta',
      'radio.allTagStations': 'Todas las estaciones de "{{tag}}"',
      'radio.allResults': 'Todos los resultados',
      'radio.resultsFor': 'Resultados para "{{query}}"',
      'radio.noStationsFor': 'No se encontraron estaciones para "{{query}}".',
      'radio.couldNotLoad': 'No se pudieron cargar las estaciones.',
      'radio.liveRadio': 'Radio en vivo',
      'radio.noQueue': 'Radio en vivo — sin cola',
      'player.play': 'Reproducir',
      'toast.radioNoStreamUrl': 'No hay URL de transmisión para esta estación',
      'toast.radioTuningIn': 'Sintonizando: {{name}}',
      'toast.radioUnavailable': 'Estación no disponible — intenta otra',
      'toast.radioStationRemoved': 'Eliminada: {{name}}',
      'toast.radioStationAdded': 'Añadida: {{name}}',
      'toast.radioStreamEnded': 'La transmisión terminó — intenta otra estación',
      'toast.radioStreamLost': 'Se perdió la señal — intenta otra estación',
      'toast.radioStreamStalled': 'La transmisión se detuvo — intenta otra estación',
    },
    pt: {
      'nav.radio': 'Rádio',
      'radio.title': 'Rádio',
      'radio.searchStations': 'Buscar estações',
      'radio.searchPlaceholder': 'Buscar estações de rádio...',
      'radio.yourStations': 'Suas estações',
      'radio.popularInCity': 'Popular em {{city}}, {{country}}',
      'radio.popularInCountry': 'Popular em {{country}}',
      'radio.popularStations': 'Estações populares',
      'radio.trendingIn': 'Em alta em {{country}}',
      'radio.trendingWorldwide': 'Em alta no mundo',
      'radio.yourCountry': 'Seu país',
      'radio.browseByTag': 'Explorar por tag',
      'radio.allTagStations': 'Todas as estações de "{{tag}}"',
      'radio.allResults': 'Todos os resultados',
      'radio.resultsFor': 'Resultados para "{{query}}"',
      'radio.noStationsFor': 'Nenhuma estação encontrada para "{{query}}".',
      'radio.couldNotLoad': 'Não foi possível carregar as estações.',
      'radio.liveRadio': 'Rádio ao vivo',
      'radio.noQueue': 'Rádio ao vivo — sem fila',
      'player.play': 'Reproduzir',
      'toast.radioNoStreamUrl': 'Sem URL de transmissão para esta estação',
      'toast.radioTuningIn': 'Sintonizando: {{name}}',
      'toast.radioUnavailable': 'Estação indisponível — tente outra',
      'toast.radioStationRemoved': 'Removida: {{name}}',
      'toast.radioStationAdded': 'Adicionada: {{name}}',
      'toast.radioStreamEnded': 'A transmissão terminou — tente outra estação',
      'toast.radioStreamLost': 'Sinal perdido — tente outra estação',
      'toast.radioStreamStalled': 'A transmissão parou — tente outra estação',
    },
    fr: {
      'nav.radio': 'Radio',
      'radio.title': 'Radio',
      'radio.searchStations': 'Rechercher des stations',
      'radio.searchPlaceholder': 'Rechercher des stations radio...',
      'radio.yourStations': 'Vos stations',
      'radio.popularInCity': 'Populaire à {{city}}, {{country}}',
      'radio.popularInCountry': 'Populaire en {{country}}',
      'radio.popularStations': 'Stations populaires',
      'radio.trendingIn': 'Tendance en {{country}}',
      'radio.trendingWorldwide': 'Tendance mondiale',
      'radio.yourCountry': 'Votre pays',
      'radio.browseByTag': 'Parcourir par tag',
      'radio.allTagStations': 'Toutes les stations "{{tag}}"',
      'radio.allResults': 'Tous les résultats',
      'radio.resultsFor': 'Résultats pour "{{query}}"',
      'radio.noStationsFor': 'Aucune station trouvée pour "{{query}}".',
      'radio.couldNotLoad': 'Impossible de charger les stations.',
      'radio.liveRadio': 'Radio en direct',
      'radio.noQueue': 'Radio en direct — pas de file',
      'player.play': 'Lecture',
      'toast.radioNoStreamUrl': 'Pas d\'URL de diffusion pour cette station',
      'toast.radioTuningIn': 'Syntonisation : {{name}}',
      'toast.radioUnavailable': 'Station indisponible — essayez une autre',
      'toast.radioStationRemoved': 'Supprimée : {{name}}',
      'toast.radioStationAdded': 'Ajoutée : {{name}}',
      'toast.radioStreamEnded': 'La diffusion a pris fin — essayez une autre station',
      'toast.radioStreamLost': 'Signal perdu — essayez une autre station',
      'toast.radioStreamStalled': 'La diffusion a calé — essayez une autre station',
    },
    de: {
      'nav.radio': 'Radio',
      'radio.title': 'Radio',
      'radio.searchStations': 'Sender suchen',
      'radio.searchPlaceholder': 'Radiosender suchen...',
      'radio.yourStations': 'Deine Sender',
      'radio.popularInCity': 'Beliebt in {{city}}, {{country}}',
      'radio.popularInCountry': 'Beliebt in {{country}}',
      'radio.popularStations': 'Beliebte Sender',
      'radio.trendingIn': 'Trending in {{country}}',
      'radio.trendingWorldwide': 'Weltweit im Trend',
      'radio.yourCountry': 'Dein Land',
      'radio.browseByTag': 'Nach Tag durchsuchen',
      'radio.allTagStations': 'Alle "{{tag}}" Sender',
      'radio.allResults': 'Alle Ergebnisse',
      'radio.resultsFor': 'Ergebnisse für "{{query}}"',
      'radio.noStationsFor': 'Keine Sender gefunden für "{{query}}".',
      'radio.couldNotLoad': 'Sender konnten nicht geladen werden.',
      'radio.liveRadio': 'Live-Radio',
      'radio.noQueue': 'Live-Radio — keine Warteschlange',
      'player.play': 'Abspielen',
      'toast.radioNoStreamUrl': 'Keine Stream-URL für diesen Sender',
      'toast.radioTuningIn': 'Einschalten: {{name}}',
      'toast.radioUnavailable': 'Sender nicht verfügbar — versuche einen anderen',
      'toast.radioStationRemoved': 'Entfernt: {{name}}',
      'toast.radioStationAdded': 'Hinzugefügt: {{name}}',
      'toast.radioStreamEnded': 'Stream beendet — versuche einen anderen Sender',
      'toast.radioStreamLost': 'Signal verloren — versuche einen anderen Sender',
      'toast.radioStreamStalled': 'Stream gestoppt — versuche einen anderen Sender',
    },
    ja: {
      'nav.radio': 'ラジオ',
      'radio.title': 'ラジオ',
      'radio.searchStations': 'ステーションを検索',
      'radio.searchPlaceholder': 'ラジオ局を検索...',
      'radio.yourStations': 'あなたのステーション',
      'radio.popularInCity': '{{city}}, {{country}}で人気',
      'radio.popularInCountry': '{{country}}で人気',
      'radio.popularStations': '人気のステーション',
      'radio.trendingIn': '{{country}}のトレンド',
      'radio.trendingWorldwide': '世界のトレンド',
      'radio.yourCountry': 'あなたの国',
      'radio.browseByTag': 'タグで閲覧',
      'radio.allTagStations': '「{{tag}}」の全ステーション',
      'radio.allResults': 'すべての結果',
      'radio.resultsFor': '「{{query}}」の検索結果',
      'radio.noStationsFor': '「{{query}}」のステーションが見つかりません。',
      'radio.couldNotLoad': 'ラジオ局を読み込めませんでした。',
      'radio.liveRadio': 'ライブラジオ',
      'radio.noQueue': 'ライブラジオ — キューなし',
      'player.play': '再生',
      'toast.radioNoStreamUrl': 'このステーションのストリームURLがありません',
      'toast.radioTuningIn': 'チューニング中: {{name}}',
      'toast.radioUnavailable': 'ステーション利用不可 — 別のステーションをお試しください',
      'toast.radioStationRemoved': '削除: {{name}}',
      'toast.radioStationAdded': '追加: {{name}}',
      'toast.radioStreamEnded': 'ストリームが終了しました — 別のステーションをお試しください',
      'toast.radioStreamLost': '信号が失われました — 別のステーションをお試しください',
      'toast.radioStreamStalled': 'ストリームが停止しました — 別のステーションをお試しください',
    },
    ko: {
      'nav.radio': '라디오',
      'radio.title': '라디오',
      'radio.searchStations': '방송국 검색',
      'radio.searchPlaceholder': '라디오 방송국 검색...',
      'radio.yourStations': '내 방송국',
      'radio.popularInCity': '{{city}}, {{country}}에서 인기',
      'radio.popularInCountry': '{{country}}에서 인기',
      'radio.popularStations': '인기 방송국',
      'radio.trendingIn': '{{country}} 트렌딩',
      'radio.trendingWorldwide': '전 세계 트렌딩',
      'radio.yourCountry': '내 나라',
      'radio.browseByTag': '태그로 탐색',
      'radio.allTagStations': '"{{tag}}" 전체 방송국',
      'radio.allResults': '모든 결과',
      'radio.resultsFor': '"{{query}}" 검색 결과',
      'radio.noStationsFor': '"{{query}}"에 대한 방송국을 찾을 수 없습니다.',
      'radio.couldNotLoad': '라디오 방송국을 불러올 수 없습니다.',
      'radio.liveRadio': '라이브 라디오',
      'radio.noQueue': '라이브 라디오 — 대기열 없음',
      'player.play': '재생',
      'toast.radioNoStreamUrl': '이 방송국의 스트림 URL이 없습니다',
      'toast.radioTuningIn': '수신 중: {{name}}',
      'toast.radioUnavailable': '방송국 이용 불가 — 다른 방송국을 시도하세요',
      'toast.radioStationRemoved': '제거됨: {{name}}',
      'toast.radioStationAdded': '추가됨: {{name}}',
      'toast.radioStreamEnded': '스트림이 종료되었습니다 — 다른 방송국을 시도하세요',
      'toast.radioStreamLost': '신호가 끊겼습니다 — 다른 방송국을 시도하세요',
      'toast.radioStreamStalled': '스트림이 멈췄습니다 — 다른 방송국을 시도하세요',
    },
    zh: {
      'nav.radio': '电台',
      'radio.title': '电台',
      'radio.searchStations': '搜索电台',
      'radio.searchPlaceholder': '搜索广播电台...',
      'radio.yourStations': '你的电台',
      'radio.popularInCity': '{{city}}, {{country}}热门',
      'radio.popularInCountry': '{{country}}热门',
      'radio.popularStations': '热门电台',
      'radio.trendingIn': '{{country}}趋势',
      'radio.trendingWorldwide': '全球趋势',
      'radio.yourCountry': '你的国家',
      'radio.browseByTag': '按标签浏览',
      'radio.allTagStations': '所有"{{tag}}"电台',
      'radio.allResults': '所有结果',
      'radio.resultsFor': '"{{query}}"的搜索结果',
      'radio.noStationsFor': '未找到"{{query}}"的电台。',
      'radio.couldNotLoad': '无法加载广播电台。',
      'radio.liveRadio': '直播电台',
      'radio.noQueue': '直播电台 — 无队列',
      'player.play': '播放',
      'toast.radioNoStreamUrl': '此电台没有流媒体URL',
      'toast.radioTuningIn': '正在调谐: {{name}}',
      'toast.radioUnavailable': '电台不可用 — 请尝试其他电台',
      'toast.radioStationRemoved': '已移除: {{name}}',
      'toast.radioStationAdded': '已添加: {{name}}',
      'toast.radioStreamEnded': '电台流已结束 — 请尝试其他电台',
      'toast.radioStreamLost': '信号丢失 — 请尝试其他电台',
      'toast.radioStreamStalled': '电台流已停滞 — 请尝试其他电台',
    },
    it: {
      'nav.radio': 'Radio',
      'radio.title': 'Radio',
      'radio.searchStations': 'Cerca stazioni',
      'radio.searchPlaceholder': 'Cerca stazioni radio...',
      'radio.yourStations': 'Le tue stazioni',
      'radio.popularInCity': 'Popolare a {{city}}, {{country}}',
      'radio.popularInCountry': 'Popolare in {{country}}',
      'radio.popularStations': 'Stazioni popolari',
      'radio.trendingIn': 'Di tendenza in {{country}}',
      'radio.trendingWorldwide': 'Di tendenza nel mondo',
      'radio.yourCountry': 'Il tuo paese',
      'radio.browseByTag': 'Sfoglia per tag',
      'radio.allTagStations': 'Tutte le stazioni "{{tag}}"',
      'radio.allResults': 'Tutti i risultati',
      'radio.resultsFor': 'Risultati per "{{query}}"',
      'radio.noStationsFor': 'Nessuna stazione trovata per "{{query}}".',
      'radio.couldNotLoad': 'Impossibile caricare le stazioni radio.',
      'radio.liveRadio': 'Radio dal vivo',
      'radio.noQueue': 'Radio dal vivo — nessuna coda',
      'player.play': 'Riproduci',
      'toast.radioNoStreamUrl': 'Nessun URL di streaming per questa stazione',
      'toast.radioTuningIn': 'Sintonizzazione: {{name}}',
      'toast.radioUnavailable': 'Stazione non disponibile — prova un\'altra',
      'toast.radioStationRemoved': 'Rimossa: {{name}}',
      'toast.radioStationAdded': 'Aggiunta: {{name}}',
      'toast.radioStreamEnded': 'Lo streaming è terminato — prova un\'altra stazione',
      'toast.radioStreamLost': 'Segnale perso — prova un\'altra stazione',
      'toast.radioStreamStalled': 'Lo streaming si è bloccato — prova un\'altra stazione',
    },
    tr: {
      'nav.radio': 'Radyo',
      'radio.title': 'Radyo',
      'radio.searchStations': 'İstasyon ara',
      'radio.searchPlaceholder': 'Radyo istasyonu ara...',
      'radio.yourStations': 'İstasyonlarınız',
      'radio.popularInCity': '{{city}}, {{country}} bölgesinde popüler',
      'radio.popularInCountry': '{{country}} bölgesinde popüler',
      'radio.popularStations': 'Popüler istasyonlar',
      'radio.trendingIn': '{{country}} trendleri',
      'radio.trendingWorldwide': 'Dünya genelinde trend',
      'radio.yourCountry': 'Ülkeniz',
      'radio.browseByTag': 'Etikete göre göz at',
      'radio.allTagStations': 'Tüm "{{tag}}" istasyonları',
      'radio.allResults': 'Tüm sonuçlar',
      'radio.resultsFor': '"{{query}}" için sonuçlar',
      'radio.noStationsFor': '"{{query}}" için istasyon bulunamadı.',
      'radio.couldNotLoad': 'Radyo istasyonları yüklenemedi.',
      'radio.liveRadio': 'Canlı Radyo',
      'radio.noQueue': 'Canlı Radyo — kuyruk yok',
      'player.play': 'Oynat',
      'toast.radioNoStreamUrl': 'Bu istasyon için yayın URL\'si yok',
      'toast.radioTuningIn': 'Ayarlanıyor: {{name}}',
      'toast.radioUnavailable': 'İstasyon kullanılamıyor — başka birini deneyin',
      'toast.radioStationRemoved': 'Kaldırıldı: {{name}}',
      'toast.radioStationAdded': 'Eklendi: {{name}}',
      'toast.radioStreamEnded': 'Yayın sona erdi — başka bir istasyon deneyin',
      'toast.radioStreamLost': 'Sinyal kesildi — başka bir istasyon deneyin',
      'toast.radioStreamStalled': 'Yayın durdu — başka bir istasyon deneyin',
    },
    ru: {
      'nav.radio': 'Радио',
      'radio.title': 'Радио',
      'radio.searchStations': 'Поиск станций',
      'radio.searchPlaceholder': 'Поиск радиостанций...',
      'radio.yourStations': 'Ваши станции',
      'radio.popularInCity': 'Популярно в {{city}}, {{country}}',
      'radio.popularInCountry': 'Популярно в {{country}}',
      'radio.popularStations': 'Популярные станции',
      'radio.trendingIn': 'В тренде в {{country}}',
      'radio.trendingWorldwide': 'В мировом тренде',
      'radio.yourCountry': 'Ваша страна',
      'radio.browseByTag': 'По тегам',
      'radio.allTagStations': 'Все станции "{{tag}}"',
      'radio.allResults': 'Все результаты',
      'radio.resultsFor': 'Результаты для "{{query}}"',
      'radio.noStationsFor': 'Станции не найдены для "{{query}}".',
      'radio.couldNotLoad': 'Не удалось загрузить радиостанции.',
      'radio.liveRadio': 'Прямой эфир',
      'radio.noQueue': 'Прямой эфир — без очереди',
      'player.play': 'Воспроизвести',
      'toast.radioNoStreamUrl': 'Нет URL потока для этой станции',
      'toast.radioTuningIn': 'Настройка: {{name}}',
      'toast.radioUnavailable': 'Станция недоступна — попробуйте другую',
      'toast.radioStationRemoved': 'Удалена: {{name}}',
      'toast.radioStationAdded': 'Добавлена: {{name}}',
      'toast.radioStreamEnded': 'Поток завершён — попробуйте другую станцию',
      'toast.radioStreamLost': 'Сигнал потерян — попробуйте другую станцию',
      'toast.radioStreamStalled': 'Поток остан��влен — попробуйте другую станцию',
    },
    hi: {
      'nav.radio': 'रेडियो',
      'radio.title': 'रेडियो',
      'radio.searchStations': 'स्टेशन खोजें',
      'radio.searchPlaceholder': 'रेडियो स्टेशन खोजें...',
      'radio.yourStations': 'आपके स्टेशन',
      'radio.popularInCity': '{{city}}, {{country}} में लोकप्रिय',
      'radio.popularInCountry': '{{country}} में लोकप्रिय',
      'radio.popularStations': 'लोकप्रिय स्टेशन',
      'radio.trendingIn': '{{country}} में ट्रेंडिंग',
      'radio.trendingWorldwide': 'विश्वभर में ट्रेंडिंग',
      'radio.yourCountry': 'आपका देश',
      'radio.browseByTag': 'टैग से ब्राउज़ करें',
      'radio.allTagStations': 'सभी "{{tag}}" स्टेशन',
      'radio.allResults': 'सभी परिणाम',
      'radio.resultsFor': '"{{query}}" के परिणाम',
      'radio.noStationsFor': '"{{query}}" के लिए कोई स्टेशन नहीं मिला।',
      'radio.couldNotLoad': 'रेडियो स्टेशन लोड नहीं हो सके।',
      'radio.liveRadio': 'लाइव रेडियो',
      'radio.noQueue': 'लाइव रेडियो — कोई कतार नहीं',
      'player.play': 'चलाएं',
      'toast.radioNoStreamUrl': 'इस स्टेशन के लिए स्ट्रीम URL नहीं है',
      'toast.radioTuningIn': 'ट्यूनिंग: {{name}}',
      'toast.radioUnavailable': 'स्टेशन उपलब्ध नहीं — दूसरा आज़माएं',
      'toast.radioStationRemoved': 'हटाया गया: {{name}}',
      'toast.radioStationAdded': 'जोड़ा गया: {{name}}',
      'toast.radioStreamEnded': 'स्ट्रीम समाप्त हुई — दूसरा स्टेशन आज़माएं',
      'toast.radioStreamLost': 'सिग्नल खो गया — दूसरा स्टेशन आज़माएं',
      'toast.radioStreamStalled': 'स्ट्रीम रुक गई — दूसरा स्टेशन आज़माएं',
    },
  };

  function t(key, params) {
    const lang = (typeof I18n !== 'undefined' && I18n.getLocale) ? I18n.getLocale() : 'en';
    let str = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v);
      });
    }
    return str;
  }

  // ═══════ Helpers ═══════
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function $(sel) { return document.querySelector(sel); }

  function isFavorite(station) {
    return _state.favoriteStations.some(s => s.stationuuid === station.stationuuid);
  }

  function updatePlayIcon(btnSelector, isPlaying) {
    const btn = $(btnSelector);
    if (!btn) return;
    const playIcon = btn.querySelector('.icon-play');
    const pauseIcon = btn.querySelector('.icon-pause');
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);
  }

  function syncPlayButton(isPlaying) {
    updatePlayIcon('#btn-play-pause', isPlaying);
    updatePlayIcon('#max-np-play', isPlaying);
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ═══════ Plugin State ═══════
  let _state = { favoriteStations: [] };
  let _active = false;
  let _station = null;
  let _ignoreAppPlayback = false;
  let _geo = null;
  let _generation = 0;
  let _stationsCache = [];
  let _searchTimer = null;
  let _audioEl = null;
  let _toastTimeout = null;
  let _stallTimer = null;
  let _savedNP = null;
  let _radioBtn = null;
  let _radioView = null;
  let _lastTimeSec = -1;    // throttle timeupdate

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.favoriteStations) _state.favoriteStations = saved.favoriteStations;
    } catch (err) {
      console.debug('[Radio Plugin] State load failed:', err.message);
    }
    // Migrate favorites from old built-in state if present
    if (!_state.favoriteStations.length) {
      try {
        const old = JSON.parse(localStorage.getItem('snowify_state'));
        if (old && old.favoriteStations && old.favoriteStations.length) {
          _state.favoriteStations = old.favoriteStations;
          saveState();
        }
      } catch (err) {
        console.debug('[Radio Plugin] Migration failed:', err.message);
      }
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  }

  // ═══════ API Layer (direct fetch — no IPC) ═══════
  async function radioFetch(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function detectGeo() {
    try {
      const res = await fetch(GEO_URL);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch (_) {
      const locale = typeof window.snowify !== 'undefined' && window.snowify.getLocale
        ? await window.snowify.getLocale()
        : (navigator.language || 'en');
      const cc = locale.includes('-') ? locale.split('-')[1] : '';
      return { country: '', countryCode: cc, city: '' };
    }
  }

  function apiByCountry(cc, limit) {
    return radioFetch('/json/stations/bycountrycodeexact/' + encodeURIComponent(cc) + '?limit=' + (limit || 20) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiTrendingByCountry(cc, limit) {
    return radioFetch('/json/stations/bycountrycodeexact/' + encodeURIComponent(cc) + '?limit=' + (limit || 20) + '&order=clickcount&reverse=true&hidebroken=true');
  }
  function apiTopClick(count) {
    return radioFetch('/json/stations/topclick/' + (count || 20));
  }
  function apiByTag(tag, limit) {
    return radioFetch('/json/stations/bytagexact/' + encodeURIComponent(tag) + '?limit=' + (limit || 30) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiSearch(query, limit) {
    return radioFetch('/json/stations/search?name=' + encodeURIComponent(query) + '&limit=' + (limit || 30) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiTags() {
    return radioFetch('/json/tags?limit=50&order=stationcount&reverse=true&hidebroken=true');
  }
  function apiClick(uuid) {
    return radioFetch('/json/url/' + encodeURIComponent(uuid)).catch(() => {});
  }

  // ═══════ Toast (reuse app's toast element) ═══════
  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(_toastTimeout);
    requestAnimationFrame(() => toast.classList.add('show'));
    _toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
  }

  // ═══════ Audio Element ═══════
  function createAudio() {
    _audioEl = new Audio();
    _audioEl.preload = 'none';
    _audioEl.addEventListener('ended', () => {
      showToast(t('toast.radioStreamEnded'));
      cleanup();
    });
    _audioEl.addEventListener('error', () => {
      if (!_active) return;
      showToast(t('toast.radioStreamLost'));
      cleanup();
    });
    _audioEl.addEventListener('stalled', () => {
      if (!_active) return;
      clearTimeout(_stallTimer);
      _stallTimer = setTimeout(() => {
        if (_active && _audioEl.readyState < 3) {
          showToast(t('toast.radioStreamStalled'));
        }
      }, 10000);
    });
    _audioEl.addEventListener('waiting', () => {
      if (!_active) return;
      $('#progress-bar')?.classList.add('radio-buffering');
      $('#max-np-progress-bar')?.classList.add('radio-buffering');
    });
    _audioEl.addEventListener('playing', () => {
      clearTimeout(_stallTimer);
      $('#progress-bar')?.classList.remove('radio-buffering');
      $('#max-np-progress-bar')?.classList.remove('radio-buffering');
    });
    // Elapsed time display (throttled to integer-second changes)
    _audioEl.addEventListener('timeupdate', () => {
      if (!_active) return;
      const secs = Math.floor(_audioEl.currentTime);
      if (secs === _lastTimeSec) return;
      _lastTimeSec = secs;
      const str = formatTime(secs);
      const tc = $('#time-current');
      if (tc) tc.textContent = str;
      const mtc = $('#max-np-time-current');
      if (mtc) mtc.textContent = str;
      // Reinforce LIVE badge (app's updateProgress may overwrite textContent)
      const tt = $('#time-total');
      if (tt && tt.textContent !== LIVE_BADGE) {
        tt.textContent = LIVE_BADGE; tt.classList.add('radio-live-badge');
      }
      const mtt = $('#max-np-time-total');
      if (mtt && mtt.textContent !== LIVE_BADGE) {
        mtt.textContent = LIVE_BADGE; mtt.classList.add('radio-live-badge');
      }
    });
  }

  // ═══════ DOM Injection ═══════
  function injectNavButton() {
    const libraryBtn = $('[data-view="library"]');
    if (!libraryBtn) return null;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.view = 'radio';
    btn.setAttribute('aria-label', t('nav.radio'));
    btn.innerHTML = NAV_ICON_SVG + '<span>' + t('nav.radio') + '</span>';
    libraryBtn.after(btn);
    return btn;
  }

  function injectView() {
    const viewsContainer = $('.views-container') || $('main') || $('body');
    const view = document.createElement('section');
    view.className = 'view';
    view.id = 'view-radio';
    view.innerHTML = `
      <div class="view-header radio-header">
        <h1>${t('radio.title')}</h1>
        <div class="radio-search-bar">
          <div class="radio-search-wrap" id="radio-search-wrap">
            <div class="radio-search-label" id="radio-search-label">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>
              <span>${t('radio.searchStations')}</span>
            </div>
            <div class="radio-search-input-wrap hidden" id="radio-search-input-wrap">
              <svg class="radio-search-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>
              <input type="text" id="radio-search-input" placeholder="${t('radio.searchPlaceholder')}" spellcheck="false" autocomplete="off" />
              <button class="search-clear hidden" id="radio-search-clear" aria-label="Clear search">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="radio-content" class="explore-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>`;
    viewsContainer.appendChild(view);
    return view;
  }

  // ═══════ View Switching ═══════
  function initViewSwitching() {
    _radioBtn.addEventListener('click', () => {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      _radioView.classList.add('active');
      _radioBtn.classList.add('active');
      resetSearchPill();
      render();
    });

    // When any app view becomes active, deactivate radio view
    document.querySelectorAll('.view').forEach(v => {
      if (v === _radioView) return;
      new MutationObserver(() => {
        if (v.classList.contains('active')) {
          _radioView.classList.remove('active');
          _radioBtn.classList.remove('active');
          cancelSearch();
        }
      }).observe(v, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ═══════ Card Builders ═══════
  function buildCard(station) {
    const hasFavicon = station.favicon?.trim();
    const coverHtml = hasFavicon
      ? '<div class="station-cover-wrap"><img class="album-card-cover station-card-cover" src="' + escapeHtml(station.favicon) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'" /><div class="station-cover-fallback station-fallback-icon" style="display:none">' + FALLBACK_SVG + '</div></div>'
      : '<div class="album-card-cover station-fallback-icon">' + FALLBACK_SVG + '</div>';
    const meta = [station.tags, station.country, station.bitrate ? station.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
    return '<div class="album-card station-card" data-station-uuid="' + escapeHtml(station.stationuuid) + '">' +
      coverHtml +
      '<button class="album-card-play" title="' + t('player.play') + '" aria-label="' + t('player.play') + '"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg></button>' +
      '<div class="album-card-name" title="' + escapeHtml(station.name) + '">' + escapeHtml(station.name) + '</div>' +
      '<div class="album-card-meta">' + escapeHtml(meta) + '</div></div>';
  }

  function buildScrollSection(title, stations) {
    const cards = stations.map(s => buildCard(s)).join('');
    return '<div class="explore-section"><h2>' + escapeHtml(title) + '</h2>' +
      '<div class="scroll-container">' +
      '<button class="scroll-arrow scroll-arrow-left" data-dir="left" aria-label="Scroll left"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<div class="album-scroll">' + cards + '</div>' +
      '<button class="scroll-arrow scroll-arrow-right" data-dir="right" aria-label="Scroll right"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '</div></div>';
  }

  function buildTrendingSection(title, stations) {
    const items = stations.map((s, i) => {
      const hasFav = s.favicon?.trim();
      const thumbHtml = hasFav
        ? '<img class="top-song-thumb" src="' + escapeHtml(s.favicon) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'" /><div class="top-song-thumb station-trending-fallback" style="display:none">' + FALLBACK_SVG + '</div>'
        : '<div class="top-song-thumb station-trending-fallback">' + FALLBACK_SVG + '</div>';
      const meta = [s.country, s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
      return '<div class="top-song-item station-trending-item" data-station-uuid="' + escapeHtml(s.stationuuid) + '">' +
        '<div class="top-song-rank">' + (i + 1) + '</div>' +
        '<div class="top-song-thumb-wrap">' + thumbHtml +
        '<div class="top-song-play"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg></div></div>' +
        '<div class="top-song-info"><div class="top-song-title">' + escapeHtml(s.name) + '</div>' +
        '<div class="top-song-artist">' + escapeHtml(meta) + '</div></div></div>';
    }).join('');
    return '<div class="explore-section"><h2>' + escapeHtml(title) + '</h2><div class="top-songs-grid">' + items + '</div></div>';
  }

  function buildGenreGrid(tags) {
    const items = tags.map((tg, i) => {
      const bg = GENRE_COLORS[i % GENRE_COLORS.length];
      return '<div class="mood-card radio-genre-card" data-tag="' + escapeHtml(tg.name) + '" style="border-left-color:' + bg + '">' + escapeHtml(tg.name) + ' <span style="opacity:0.5;font-size:11px">' + tg.stationcount + '</span></div>';
    }).join('');
    return '<div class="explore-section"><h2>' + t('radio.browseByTag') + '</h2><div class="mood-grid">' + items + '</div></div>';
  }

  // ═══════ Station Lookup ═══════
  // Checks favorites first (user data), then API-loaded cache
  function findByUuid(uuid) {
    return _state.favoriteStations.find(s => s.stationuuid === uuid)
      || _stationsCache.find(s => s.stationuuid === uuid)
      || null;
  }

  // ═══════ Attach Listeners ═══════
  function attachListeners(content) {
    // Scroll arrows
    content.querySelectorAll('.scroll-container').forEach(container => {
      const scrollEl = container.querySelector('.album-scroll');
      if (!scrollEl) return;
      container.querySelectorAll('.scroll-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = btn.dataset.dir === 'left' ? -SCROLL_DISTANCE : SCROLL_DISTANCE;
          scrollEl.scrollBy({ left: dir, behavior: 'smooth' });
        });
      });
    });

    // Station card clicks — FIX: use .stationuuid (lowercase, matches dataset auto-conversion)
    content.querySelectorAll('.station-card').forEach(card => {
      const handler = () => {
        const station = findByUuid(card.dataset.stationUuid);
        if (station) play(station);
      };
      card.addEventListener('click', handler);
      const playBtn = card.querySelector('.album-card-play');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
      }
    });

    // Trending item clicks
    content.querySelectorAll('.station-trending-item').forEach(item => {
      item.addEventListener('click', () => {
        const station = findByUuid(item.dataset.stationUuid);
        if (station) play(station);
      });
    });

    // Genre card clicks
    content.querySelectorAll('.radio-genre-card').forEach(card => {
      card.addEventListener('click', async () => {
        const tag = card.dataset.tag;
        if (!tag) return;
        const contentEl = $('#radio-content');
        contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
          const stations = await apiByTag(tag);
          _stationsCache = stations;
          let html = '';
          if (stations.length) {
            html += buildScrollSection(tag, stations);
            html += buildTrendingSection(t('radio.allTagStations', { tag }), stations);
          } else {
            html += '<div class="empty-state"><p>' + t('radio.noStationsFor', { query: escapeHtml(tag) }) + '</p></div>';
          }
          contentEl.innerHTML = html;
          attachListeners(contentEl);
        } catch (err) {
          contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
        }
      });
    });
  }

  // ═══════ Render Radio View ═══════
  async function render() {
    const content = $('#radio-content');
    if (!content) return;
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      if (!_geo) _geo = await detectGeo();
      const hasGeo = !!_geo.countryCode;

      const [local, trendingCountry, trendingWorld, tags] = await Promise.all([
        hasGeo ? apiByCountry(_geo.countryCode) : Promise.resolve([]),
        hasGeo ? apiTrendingByCountry(_geo.countryCode, 20) : Promise.resolve([]),
        apiTopClick(20),
        apiTags(),
      ]);

      let html = '';

      if (_state.favoriteStations.length)
        html += buildScrollSection(t('radio.yourStations'), _state.favoriteStations);

      if (local.length) {
        const label = _geo.city
          ? t('radio.popularInCity', { city: _geo.city, country: _geo.country })
          : (_geo.country ? t('radio.popularInCountry', { country: _geo.country }) : t('radio.popularStations'));
        html += buildScrollSection(label, local);
      }

      if (trendingCountry.length) {
        const countryLabel = _geo.country || t('radio.yourCountry');
        html += buildTrendingSection(t('radio.trendingIn', { country: countryLabel }), trendingCountry);
      }

      if (trendingWorld.length)
        html += buildTrendingSection(t('radio.trendingWorldwide'), trendingWorld);

      if (tags.length)
        html += buildGenreGrid(tags.slice(0, 30));

      _stationsCache = [..._state.favoriteStations, ...local, ...trendingCountry, ...trendingWorld];
      content.innerHTML = html || '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
      attachListeners(content);
    } catch (err) {
      console.error('[Radio Plugin] render error:', err);
      content.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
    }
  }

  // ═══════ Search ═══════
  function initSearch() {
    const input = $('#radio-search-input');
    const clearBtn = $('#radio-search-clear');
    const label = $('#radio-search-label');
    const inputWrap = $('#radio-search-input-wrap');
    if (!input || !clearBtn) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('hidden', !q);
      clearTimeout(_searchTimer);
      if (!q) {
        render();
        return;
      }
      _searchTimer = setTimeout(async () => {
        const contentEl = $('#radio-content');
        contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
          const results = await apiSearch(q);
          _stationsCache = results;
          if (!results.length) {
            contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.noStationsFor', { query: escapeHtml(q) }) + '</p></div>';
            return;
          }
          let html = buildScrollSection(t('radio.resultsFor', { query: q }), results);
          html += buildTrendingSection(t('radio.allResults'), results);
          contentEl.innerHTML = html;
          attachListeners(contentEl);
        } catch (err) {
          contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
        }
      }, SEARCH_DEBOUNCE);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      inputWrap.classList.add('hidden');
      label.classList.remove('hidden');
      render();
    });

    label.addEventListener('click', () => {
      label.classList.add('hidden');
      inputWrap.classList.remove('hidden');
      input.focus();
    });

    input.addEventListener('blur', () => {
      if (!input.value.trim()) {
        inputWrap.classList.add('hidden');
        label.classList.remove('hidden');
      }
    });
  }

  function cancelSearch() {
    if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
  }

  function resetSearchPill() {
    const ri = $('#radio-search-input');
    const rl = $('#radio-search-label');
    const rw = $('#radio-search-input-wrap');
    const rc = $('#radio-search-clear');
    if (ri) ri.value = '';
    if (rl) rl.classList.remove('hidden');
    if (rw) rw.classList.add('hidden');
    if (rc) rc.classList.add('hidden');
  }

  // ═══════ Main App Integration ═══════
  function pauseMainApp() {
    document.querySelectorAll('audio').forEach(a => {
      if (a !== _audioEl && !a.paused) a.pause();
    });
  }

  function getAppVolume() {
    const fill = document.querySelector('#volume-fill') || document.querySelector('.volume-fill');
    if (fill) {
      const w = parseFloat(fill.style.width);
      if (!isNaN(w)) return (w / 100) * VOLUME_SCALE;
    }
    return 0.5 * VOLUME_SCALE;
  }

  // ═══════ Now Playing Takeover ═══════
  function saveNP() {
    _savedNP = {
      thumbnail: $('#np-thumbnail')?.src || '',
      title: $('#np-title')?.textContent || '',
      artist: $('#np-artist')?.textContent || '',
    };
  }

  function showRadioNP(station) {
    if (!_savedNP) saveNP();
    document.body.classList.add('radio-plugin-active');

    const bar = $('#now-playing-bar');
    if (bar) bar.classList.remove('hidden');
    const app = $('#app');
    if (app) app.classList.remove('no-player');

    const npThumb = $('#np-thumbnail');
    if (npThumb) {
      npThumb.src = station.favicon || FALLBACK_IMG;
      if (station.favicon) {
        npThumb.onerror = () => { npThumb.src = FALLBACK_IMG; npThumb.onerror = null; };
      }
    }

    const npTitle = $('#np-title');
    if (npTitle) {
      npTitle.textContent = station.name;
      npTitle.classList.remove('clickable');
      npTitle.onclick = null;
    }

    const npArtist = $('#np-artist');
    if (npArtist) {
      const meta = [station.tags, station.country, station.bitrate ? station.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
      npArtist.textContent = meta || t('radio.liveRadio');
      npArtist.classList.remove('clickable');
      npArtist.onclick = null;
    }

    // Like button state
    $('#np-like')?.classList.toggle('liked', isFavorite(station));

    // LIVE badge + time reset (use rAF to ensure it runs AFTER any pending app timeupdate)
    requestAnimationFrame(() => {
      const timeTotal = $('#time-total');
      if (timeTotal) { timeTotal.textContent = LIVE_BADGE; timeTotal.classList.add('radio-live-badge'); }
      const maxTimeTotal = $('#max-np-time-total');
      if (maxTimeTotal) { maxTimeTotal.textContent = LIVE_BADGE; maxTimeTotal.classList.add('radio-live-badge'); }

      const pf = document.querySelector('.progress-fill');
      if (pf) pf.style.width = '0%';
      const mpf = document.querySelector('.max-np-progress-fill');
      if (mpf) mpf.style.width = '0%';

      const timeCurrent = $('#time-current');
      if (timeCurrent) timeCurrent.textContent = '0:00';
      const maxTimeCurrent = $('#max-np-time-current');
      if (maxTimeCurrent) maxTimeCurrent.textContent = '0:00';
    });
  }

  function cleanupNP() {
    document.body.classList.remove('radio-plugin-active');

    const timeTotal = $('#time-total');
    if (timeTotal) { timeTotal.classList.remove('radio-live-badge'); timeTotal.textContent = '0:00'; }
    const maxTimeTotal = $('#max-np-time-total');
    if (maxTimeTotal) { maxTimeTotal.classList.remove('radio-live-badge'); maxTimeTotal.textContent = '0:00'; }
    const timeCurrent = $('#time-current');
    if (timeCurrent) timeCurrent.textContent = '0:00';
    const maxTimeCurrent = $('#max-np-time-current');
    if (maxTimeCurrent) maxTimeCurrent.textContent = '0:00';

    $('#progress-bar')?.classList.remove('radio-buffering');
    $('#max-np-progress-bar')?.classList.remove('radio-buffering');

    if (_savedNP) {
      const npThumb = $('#np-thumbnail');
      if (npThumb) npThumb.src = _savedNP.thumbnail || FALLBACK_IMG;
      const npTitle = $('#np-title');
      if (npTitle) npTitle.textContent = _savedNP.title;
      const npArtist = $('#np-artist');
      if (npArtist) npArtist.textContent = _savedNP.artist;
      _savedNP = null;
    }

    // Clear Discord presence
    if (window.snowify && window.snowify.clearPresence) {
      window.snowify.clearPresence().catch(() => {});
    }

    // Reset MediaSession so app can reclaim it
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.metadata = null;
    }
  }

  // ═══════ Playback ═══════
  async function play(station) {
    const streamUrl = station.url_resolved || station.url;
    if (!streamUrl) {
      showToast(t('toast.radioNoStreamUrl'));
      return;
    }

    const gen = ++_generation;

    // Stop current radio stream if switching stations
    if (_active && _audioEl) _audioEl.pause();

    // Block the observer while we set up radio playback
    _ignoreAppPlayback = true;

    // Pause main app's playback
    pauseMainApp();
    document.body.classList.remove('audio-playing');

    _active = true;
    _station = station;
    _lastTimeSec = -1;
    clearTimeout(_stallTimer);

    showRadioNP(station);
    syncPlayButton(true);

    // Re-enable observer after all sync DOM mutations are done
    requestAnimationFrame(() => { _ignoreAppPlayback = false; });

    try {
      showToast(t('toast.radioTuningIn', { name: station.name }));
      _audioEl.src = streamUrl;
      _audioEl.load();
      _audioEl.volume = getAppVolume();

      let playTimer;
      const playPromise = _audioEl.play();
      const timeoutPromise = new Promise((_, reject) => {
        playTimer = setTimeout(() => reject(new Error('Timeout')), PLAY_TIMEOUT);
      });
      await Promise.race([playPromise, timeoutPromise]);
      clearTimeout(playTimer);

      if (gen !== _generation) return;
      updateDiscordPresence(station);
      updateMediaSession(station);
      apiClick(station.stationuuid);
    } catch (err) {
      if (gen !== _generation) return;
      if (err && err.name === 'AbortError') return;
      console.error('[Radio Plugin] play error:', err);
      showToast(t('toast.radioUnavailable'));
      cleanup();
    }
  }

  function cleanup() {
    if (!_active) return;
    _active = false;
    _station = null;
    clearTimeout(_stallTimer);
    _audioEl.pause();
    _audioEl.removeAttribute('src');
    _audioEl.load();
    syncPlayButton(false);
    cleanupNP();
  }

  function radioTogglePlay() {
    if (!_active || !_audioEl) return;
    if (_audioEl.paused) {
      _audioEl.play().catch(() => {});
      syncPlayButton(true);
    } else {
      _audioEl.pause();
      syncPlayButton(false);
    }
  }

  // ═══════ Like Animations ═══════
  const BROKEN_HEART_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)"><path d="M2 8.5C2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09V21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5z"/><path d="M12 5.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35V5.09z" transform="translate(1.5, 2) rotate(8, 12, 12)"/></svg>';

  function spawnHeartParticles(originEl) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 7; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart-particle';
      heart.textContent = '\u2764';
      const angle = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.6;
      const dist = 20 + Math.random() * 25;
      heart.style.left = cx + 'px';
      heart.style.top = cy + 'px';
      heart.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      heart.style.setProperty('--dy', (Math.sin(angle) * dist - 15) + 'px');
      heart.style.setProperty('--s', 0.6 + Math.random() * 0.5);
      document.body.appendChild(heart);
      heart.addEventListener('animationend', () => heart.remove());
    }
  }

  function spawnBrokenHeart(originEl) {
    const rect = originEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'broken-heart';
    el.innerHTML = BROKEN_HEART_SVG;
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height / 2 + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ═══════ Favorites ═══════
  function toggleFavorite(station, originEl) {
    if (!station) return;
    const idx = _state.favoriteStations.findIndex(s => s.stationuuid === station.stationuuid);
    if (idx >= 0) {
      _state.favoriteStations.splice(idx, 1);
      showToast(t('toast.radioStationRemoved', { name: station.name }));
    } else {
      _state.favoriteStations.push({
        stationuuid: station.stationuuid, name: station.name,
        url: station.url || '', url_resolved: station.url_resolved || '', favicon: station.favicon || '',
        tags: station.tags || '', country: station.country || '',
        countrycode: station.countrycode || '', bitrate: station.bitrate || 0,
        codec: station.codec || ''
      });
      showToast(t('toast.radioStationAdded', { name: station.name }));
    }
    const fav = idx < 0;
    $('#np-like')?.classList.toggle('liked', fav);
    $('#max-np-like')?.classList.toggle('liked', fav);
    if (originEl) {
      if (fav) spawnHeartParticles(originEl);
      else spawnBrokenHeart(originEl);
    }
    saveState();
    if (_radioView && _radioView.classList.contains('active')) render();
    return fav;
  }

  // ═══════ Discord RPC + MediaSession ═══════
  function updateDiscordPresence(station) {
    if (!station || !window.snowify || !window.snowify.updatePresence) return;
    window.snowify.updatePresence({
      title: station.name,
      artist: t('radio.liveRadio'),
      thumbnail: station.favicon || '',
      startTimestamp: Date.now()
    }).catch(() => {});
  }

  function updateMediaSession(station) {
    if (!('mediaSession' in navigator) || !station) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: t('radio.liveRadio'),
      artwork: station.favicon ? [{ src: station.favicon, sizes: '96x96' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => radioTogglePlay());
    navigator.mediaSession.setActionHandler('pause', () => radioTogglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('seekto', null);
  }

  // ═══════ Interceptors (split into focused functions) ═══════

  function interceptButton(selector, guard, handler) {
    const btn = $(selector);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      if (!guard()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      handler();
    }, true);
  }

  function interceptPlayButtons() {
    const guard = () => _active;
    interceptButton('#btn-play-pause', guard, radioTogglePlay);
    interceptButton('#max-np-play', guard, radioTogglePlay);
  }

  function interceptLikeButtons() {
    const guard = () => _active && !!_station;
    ['#np-like', '#max-np-like'].forEach(sel => {
      const btn = $(sel);
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        if (!guard()) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        toggleFavorite(_station, btn);
      }, true);
    });
  }

  function observeVolume() {
    const volumeFill = document.querySelector('#volume-fill') || document.querySelector('.volume-fill');
    if (!volumeFill) return;
    new MutationObserver(() => {
      if (!_active || !_audioEl) return;
      _audioEl.volume = getAppVolume();
    }).observe(volumeFill, { attributes: true, attributeFilter: ['style'] });
  }

  function observeAppPlayback() {
    // Detect when app starts playing music → stop radio
    // The app toggles body.audio-playing in updatePlayButton() on every play state change,
    // including programmatic ones (keyboard, MediaSession, sidebar).
    // This is more reliable than watching SVG icon classes.
    new MutationObserver(() => {
      if (!_active || _ignoreAppPlayback) return;
      if (document.body.classList.contains('audio-playing')) {
        cleanup();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function guardAppAudio() {
    // When app's audio starts playing while radio is active, stop radio
    // and let the song continue. Covers playTrack(), sidebar clicks, etc.
    ['#audio-player', '#audio-player-b'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('play', () => {
        if (!_active || _ignoreAppPlayback) return;
        cleanup();
      });
    });
  }

  function interceptKeyboard() {
    // Intercept spacebar so it toggles radio instead of app's togglePlay()
    document.addEventListener('keydown', (e) => {
      if (!_active) return;
      if (e.code === 'Space' && !e.target.matches('input, textarea, [contenteditable]')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        radioTogglePlay();
      }
    }, true);
  }

  function initInterceptors() {
    interceptPlayButtons();
    interceptLikeButtons();
    interceptKeyboard();
    observeVolume();
    observeAppPlayback();
    guardAppAudio();
  }

  // ═══════ Init ═══════
  function init() {
    loadState();
    createAudio();

    _radioBtn = injectNavButton();
    _radioView = injectView();
    if (!_radioBtn || !_radioView) {
      console.error('[Radio Plugin] Failed to inject DOM elements');
      return;
    }

    initViewSwitching();
    initSearch();
    initInterceptors();

    console.log('[Radio Plugin] Initialized');
  }

  init();
})();
