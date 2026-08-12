/**
 * Визуальный редактор шаблонов табло
 *
 * Страница: templates_visual.html
 * - Один редактор табло
 * - Список шаблонов слева
 * - При первом сохранении — диалог выбора имени
 * - Загрузка, сохранение, удаление шаблонов
 */

(function() {
  'use strict';

  // ============================================================================
  // СОСТОЯНИЕ
  // ============================================================================

  /** ID текущего редактируемого шаблона (null = новый) */
  var currentTemplateId = null;

  /** Кэш данных текущего шаблона */
  var currentData = null;

  /** Список всех шаблонов из БД */
  var templateList = [];

  /** Выбранный блок (DOM элемент) */
  var selectedBlock = null;

  /** Карта: data-style-property → { bg, text } */
  var PROPERTY_MAP = {
    logo_base64:           { bg: null,                    text: null },
    body_bg:               { bg: 'body_bg',               text: null },
    top_team_name_bg:      { bg: 'top_team_name_bg',      text: 'top_team_name_text' },
    top_team_name_text:    { bg: 'top_team_name_bg',      text: 'top_team_name_text' },
    top_primary_score_bg:  { bg: 'top_primary_score_bg',  text: 'top_primary_score_text' },
    top_primary_score_text:{ bg: 'top_primary_score_bg',  text: 'top_primary_score_text' },
    top_secondary_score_bg:{ bg: 'top_secondary_score_bg', text: 'top_secondary_score_text' },
    top_secondary_score_text:{ bg: 'top_secondary_score_bg',text: 'top_secondary_score_text' },
    top_period_bg:         { bg: 'top_period_bg',         text: 'top_period_text' },
    top_period_text:       { bg: 'top_period_bg',         text: 'top_period_text' },
    bottom_team_name_bg:   { bg: 'bottom_team_name_bg',   text: 'bottom_team_name_text' },
    bottom_team_name_text: { bg: 'bottom_team_name_bg',   text: 'bottom_team_name_text' },
    bottom_primary_score_bg:{ bg: 'bottom_primary_score_bg',text: 'bottom_primary_score_text' },
    bottom_primary_score_text:{ bg: 'bottom_primary_score_bg',text: 'bottom_primary_score_text' },
    bottom_secondary_score_bg:{ bg: 'bottom_secondary_score_bg',text: 'bottom_secondary_score_text' },
    bottom_secondary_score_text:{ bg: 'bottom_secondary_score_bg',text: 'bottom_secondary_score_text' },
    bottom_time_bg:        { bg: 'bottom_time_bg',        text: 'bottom_time_text' },
    bottom_time_text:      { bg: 'bottom_time_bg',        text: 'bottom_time_text' },
    setball_bg:            { bg: 'setball_bg',            text: 'setball_text' },
    setball_text:          { bg: 'setball_bg',            text: 'setball_text' },
    matchball_bg:          { bg: 'matchball_bg',          text: 'matchball_text' },
    matchball_text:        { bg: 'matchball_bg',          text: 'matchball_text' }
  };

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ
  // ============================================================================

  function getContrastColor(hexcolor) {
    if (!hexcolor || typeof hexcolor !== 'string') return '#ffffff';
    if (hexcolor.startsWith('#')) {
      hexcolor = hexcolor.slice(1);
    }
    if (hexcolor.length === 3) {
      hexcolor = hexcolor.split('').map(char => char + char).join('');
    }
    if (hexcolor.length !== 6) return '#ffffff';

    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  }

  function showNotification(message, type) {
    type = type || 'success';
    var $n = $('#notification');
    $n.removeClass('success error show').text(message).addClass(type);
    setTimeout(function() { $n.addClass('show'); }, 50);
    setTimeout(function() { $n.removeClass('show'); }, 3000);
  }

  function applyPreview(data) {
    if (!data) return;
    var root = document.documentElement;
    for (var key in data) {
      if (data.hasOwnProperty(key) && data[key] && key !== 'logo_base64') {
        root.style.setProperty('--' + key.replace(/_/g, '-'), data[key]);
      }
    }
    // Также устанавливаем CSS-переменные для текста счёта (используются в sb.html)
    root.style.setProperty('--top-primary-score-text', data.top_primary_score_text || '#ffffff');
    root.style.setProperty('--top-secondary-score-text', data.top_secondary_score_text || '#ffffff');

    // Обновляем логотип в предпросмотре
    var logoImg = $('#scoreboard-preview .logo-img');
    if (logoImg.length) {
      logoImg.attr('src', data.logo_base64 || 'logo_nvl.png');
    }
  }

  function updateScoreboardColors(data) {
    if (!data) return;
    var bodyBg = data.body_bg || '#1a2b3c';
    $('body').css('background-color', bodyBg);

    var contrastColor = getContrastColor(bodyBg);
    if (contrastColor === '#000000') {
        $('body').addClass('light-theme').removeClass('dark-theme');
    } else {
        $('body').addClass('dark-theme').removeClass('light-theme');
    }

    // Обновляем фон и текст для каждого кликабельного блока
    $('.clickable-block[data-style-property]').each(function() {
      var $block = $(this);
      var prop = $block.data('style-property');
      var mapping = PROPERTY_MAP[prop];
      if (!mapping) return;
      var bgColor = data[mapping.bg];
      var textColor = mapping.text ? data[mapping.text] : null;
      if (bgColor) $block.css('background-color', bgColor);
      if (textColor) $block.css('color', textColor);
    });

    // Специальные области (фон)
    $('.teams-area').css('background-color', data.top_team_name_bg || '#1a2b3c');
    $('.team-colors-area').css('background-color', data.top_team_name_bg || '#1a2b3c');
    $('.scores-area').css('background-color', data.top_team_name_bg || '#1a2b3c');

    // Цвет текста имени команды — применяем ко всем дочерним элементам,
    // чтобы переопределить возможные CSS-стили
    var teamNameText = data.top_team_name_text || '#ffffff';
    $('.teams-area').css('color', teamNameText);
    $('.teams-area .team-row').css('color', teamNameText);
    $('.teams-area .team-row .tn').css('color', teamNameText);

    // Цвет текста в колонках счёта — применяем к самим колонкам и их содержимому
    var secondaryText = data.top_secondary_score_text || '#ffffff';
    $('.score-column.total-score, .score-column.sets-score').css('color', secondaryText);
    $('.score-column.total-score div, .score-column.sets-score div').css('color', secondaryText);

    var primaryText = data.top_primary_score_text || '#ffffff';
    $('.score-column.points-score').css('color', primaryText);
    $('.score-column.points-score div').css('color', primaryText);

    // Бейджи
    $('.badge-setball').css('background-color', data.setball_bg || '#5aa0c4');
    $('.badge-setball').css('color', data.setball_text || '#ffffff');
    $('.badge-matchball').css('background-color', data.matchball_bg || '#d65a98');
    $('.badge-matchball').css('color', data.matchball_text || '#ffffff');
  }

  // ============================================================================
  // СПИСОК ШАБЛОНОВ
  // ============================================================================

  function renderTemplateList() {
    var $list = $('#templateList');
    if (!templateList.length) {
      $list.html('<li style="color:#666;font-style:italic;cursor:default;">Нет сохранённых шаблонов</li>');
      return;
    }
    var html = '';
    for (var i = 0; i < templateList.length; i++) {
      var t = templateList[i];
      var active = (t.id === currentTemplateId) ? ' active' : '';
      html += '<li class="' + active + '" data-id="' + t.id + '">';
      html += '<span>' + escapeHtml(t.name) + '</span>';
      html += '<button class="delete-btn" data-id="' + t.id + '" title="Удалить">&times;</button>';
      html += '</li>';
    }
    $list.html(html);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  }

  function loadTemplateList() {
    return DB.templates.list().then(function(list) {
      templateList = list;
      renderTemplateList();
      return list;
    }).catch(function(err) {
      console.error('[Templates Visual] Error loading list:', err);
      templateList = [];
      renderTemplateList();
    });
  }

  // ============================================================================
  // ЗАГРУЗКА / ВЫБОР ШАБЛОНА
  // ============================================================================

  function loadTemplate(templateId) {
    if (!templateId) {
      // Новый шаблон
      currentTemplateId = null;
      currentData = DB.templates.getDefaultTemplate();
      applyToEditor(currentData, '— новый шаблон —');
      renderTemplateList();
      return Promise.resolve();
    }

    return DB.templates.get(templateId).then(function(data) {
      currentTemplateId = templateId;
      currentData = data || DB.templates.getDefaultTemplate();
      var name = '';
      for (var i = 0; i < templateList.length; i++) {
        if (templateList[i].id === templateId) { name = templateList[i].name; break; }
      }
      applyToEditor(currentData, name || templateId);
      renderTemplateList();
    }).catch(function(err) {
      console.error('[Templates Visual] Error loading:', templateId, err);
      showNotification('Ошибка загрузки шаблона', 'error');
    });
  }

  function applyToEditor(data, label) {
    currentData = JSON.parse(JSON.stringify(data));
    updateScoreboardColors(currentData);
    applyPreview(currentData);

    // Управляем видимостью кнопки удаления логотипа
    var btnDeleteLogo = $('#btnDeleteLogo');
    if (btnDeleteLogo) {
      if (currentData.logo_base64) {
        btnDeleteLogo.show();
      } else {
        btnDeleteLogo.hide();
      }
    }

    $('#templateLabel').text(label || '— шаблон не выбран —');
    closeColorPanel();
  }

  // ============================================================================
  // ПАНЕЛЬ ЦВЕТА
  // ============================================================================

  function openColorPanel($block) {
    selectedBlock = $block;
    var prop = $block.data('style-property');
    var blockName = $block.data('block-name') || prop;
    var mapping = PROPERTY_MAP[prop];

    // Специальная логика для логотипа
    if (prop === 'logo_base64') {
      $('#logoUpload').click(); // Открываем диалог выбора файла
      return;
    }

    // Если для логотипа открылась панель (не должно, но на всякий случай)
    if (!mapping) return;


    if (!mapping) return;

    var bgColor = currentData[mapping.bg] || '#ffffff';
    var textColor = mapping.text ? (currentData[mapping.text] || '#000000') : '#000000';

    $('#panelTitle').text(blockName);
    $('#panelColorPicker').val(bgColor);
    $('#panelColorHex').val(bgColor);
    $('#panelTextColorPicker').val(textColor);
    $('#panelTextColorHex').val(textColor);

    if (mapping.text) {
      $('#panelTextColorPicker').closest('.color-row').show();
    } else {
      $('#panelTextColorPicker').closest('.color-row').hide();
    }

    $('.clickable-block.selected').removeClass('selected');
    $block.addClass('selected');
    $('#colorPanel').addClass('open');
  }

  function closeColorPanel() {
    $('#colorPanel').removeClass('open');
    $('.clickable-block.selected').removeClass('selected');
    selectedBlock = null;
  }

  function updateBlockColor(bgColor, textColor) {
    if (!selectedBlock || !currentData) return;
    var prop = selectedBlock.data('style-property');
    var mapping = PROPERTY_MAP[prop];
    if (!mapping) return;

    currentData[mapping.bg] = bgColor;
    if (mapping.text && textColor) {
      currentData[mapping.text] = textColor;
    }
    updateScoreboardColors(currentData);
    applyPreview(currentData);
  }

  // ============================================================================
  // СОХРАНЕНИЕ
  // ============================================================================

  function saveTemplate(templateId, name) {
    var $btn = $('#btnSave');
    $btn.prop('disabled', true).text('💾 Сохранение...');

    // Если это новый шаблон — показываем диалог
    if (!templateId) {
      $btn.prop('disabled', false).text('💾 Сохранить');
      showSaveDialog();
      return;
    }

    // Добавляем name в данные
    var dataToSave = JSON.parse(JSON.stringify(currentData));
    // Сохраняем отображаемое имя из поля name (если не передано явно),
    // чтобы не перезаписывать его транслитерированным templateId
    dataToSave.name = name || currentData.name || templateId;

    DB.templates.update(templateId, dataToSave).then(function() {
      showNotification('Шаблон "' + (name || templateId) + '" сохранён', 'success');
      return loadTemplateList();
    }).catch(function(err) {
      showNotification('Ошибка сохранения: ' + (err.message || ''), 'error');
    }).finally(function() {
      $btn.prop('disabled', false).text('💾 Сохранить');
    });
  }

  function showSaveDialog() {
    $('#saveDialogInput').val('');
    $('#saveDialog').addClass('open');
    setTimeout(function() { $('#saveDialogInput').focus(); }, 100);
  }

  function confirmSave() {
    var name = $('#saveDialogInput').val().trim();
    if (!name) {
      showNotification('Введите название шаблона', 'error');
      return;
    }

    // Генерируем ID из названия (с транслитерацией если нужно)
    var id = generateTemplateId(name);

    // Проверяем, нет ли уже шаблона с таким ID
    for (var i = 0; i < templateList.length; i++) {
      if (templateList[i].id === id) {
        showNotification('Шаблон с таким именем уже существует', 'error');
        return;
      }
    }

    $('#saveDialog').removeClass('open');
    currentTemplateId = id;

    var dataToSave = JSON.parse(JSON.stringify(currentData));
    dataToSave.name = name;

    var $btn = $('#btnSave');
    $btn.prop('disabled', true).text('💾 Сохранение...');

    DB.templates.update(id, dataToSave).then(function() {
      showNotification('Шаблон "' + name + '" создан и сохранён', 'success');
      $('#templateLabel').text(name);
      return loadTemplateList();
    }).catch(function(err) {
      showNotification('Ошибка сохранения: ' + (err.message || ''), 'error');
    }).finally(function() {
      $btn.prop('disabled', false).text('💾 Сохранить');
    });
  }

  // ============================================================================
  // УДАЛЕНИЕ
  // ============================================================================

  function confirmDelete(templateId) {
    var name = '';
    for (var i = 0; i < templateList.length; i++) {
      if (templateList[i].id === templateId) { name = templateList[i].name; break; }
    }
    $('#deleteDialogText').text('Удалить шаблон "' + (name || templateId) + '"? Это действие нельзя отменить.');
    $('#deleteDialog').addClass('open').data('delete-id', templateId);
  }

  function executeDelete() {
    var templateId = $('#deleteDialog').data('delete-id');
    if (!templateId) return;
    $('#deleteDialog').removeClass('open');

    DB.templates.delete(templateId).then(function() {
      showNotification('Шаблон удалён', 'success');
      if (currentTemplateId === templateId) {
        // Если удалили текущий — создаём новый
        currentTemplateId = null;
        currentData = DB.templates.getDefaultTemplate();
        applyToEditor(currentData, '— новый шаблон —');
      }
      return loadTemplateList();
    }).catch(function(err) {
      showNotification('Ошибка удаления: ' + (err.message || ''), 'error');
    });
  }

  // ============================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================================

  function initPage() {
    console.log('[Templates Visual] Initializing');
    $('#mainContainer').show();
    $('#authDenied').hide();

    // Загружаем список шаблонов
    loadTemplateList().then(function() {
      // Если есть шаблоны — загружаем первый
      if (templateList.length > 0) {
        return loadTemplate(templateList[0].id);
      } else {
        // Иначе начинаем с нового
        return loadTemplate(null);
      }
    });

    // ========================================================================
    // КЛИК ПО ШАБЛОНУ В СПИСКЕ
    // ========================================================================

    $('#templateList').on('click', 'li', function(e) {
      if ($(e.target).is('.delete-btn')) return;
      var id = $(this).data('id');
      if (id && id !== currentTemplateId) {
        loadTemplate(id);
      }
    });

    // ========================================================================
    // УДАЛЕНИЕ ШАБЛОНА
    // ========================================================================

    $('#templateList').on('click', '.delete-btn', function(e) {
      e.stopPropagation();
      var id = $(this).data('id');
      confirmDelete(id);
    });

    // ========================================================================
    // НОВЫЙ ШАБЛОН
    // ========================================================================

    $('#btnNewTemplate').on('click', function() {
      loadTemplate(null);
    });

    // ========================================================================
    // КЛИК ПО БЛОКУ ТАБЛО
    // ========================================================================

    $('.clickable-block').on('click', function(e) {
      e.stopPropagation();
      openColorPanel($(this));
    });

    // ========================================================================
    // COLOR PICKER
    // ========================================================================

    $('#panelColorPicker').on('input', function() {
      var color = $(this).val();
      $('#panelColorHex').val(color);
      updateBlockColor(color, $('#panelTextColorPicker').val());
    });

    $('#panelTextColorPicker').on('input', function() {
      var color = $(this).val();
      $('#panelTextColorHex').val(color);
      updateBlockColor($('#panelColorPicker').val(), color);
    });

    // Ручной ввод hex-кода цвета фона
    $('#panelColorHex').on('input', function() {
      var value = $.trim($(this).val());
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        $('#panelColorPicker').val(value);
        updateBlockColor(value, $('#panelTextColorPicker').val());
      }
    });

    // Ручной ввод hex-кода цвета текста
    $('#panelTextColorHex').on('input', function() {
      var value = $.trim($(this).val());
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        $('#panelTextColorPicker').val(value);
        updateBlockColor($('#panelColorPicker').val(), value);
      }
    });

    // ========================================================================
    // ЗАКРЫТИЕ ПАНЕЛИ
    // ========================================================================

    $('#panelClose').on('click', closeColorPanel);
    $(document).on('click', function(e) {
      if ($('#colorPanel').hasClass('open') &&
          !$(e.target).closest('#colorPanel').length &&
          !$(e.target).closest('.clickable-block').length) {
        closeColorPanel();
      }
    });

    // ========================================================================
    // СОХРАНЕНИЕ
    // ========================================================================

    $('#btnSave').on('click', function() {
      saveTemplate(currentTemplateId);
    });

    // ========================================================================
    // ДИАЛОГ СОХРАНЕНИЯ
    // ========================================================================

    $('#saveDialogConfirm').on('click', confirmSave);
    $('#saveDialogCancel').on('click', function() { $('#saveDialog').removeClass('open'); });
    $('#saveDialogInput').on('keydown', function(e) {
      if (e.key === 'Enter') confirmSave();
      if (e.key === 'Escape') $('#saveDialog').removeClass('open');
    });

    // ========================================================================
    // ДИАЛОГ УДАЛЕНИЯ
    // ========================================================================

    $('#deleteDialogConfirm').on('click', executeDelete);
    $('#deleteDialogCancel').on('click', function() { $('#deleteDialog').removeClass('open'); });

    // ========================================================================
    // СБРОС
    // ========================================================================

    $('#btnReset').on('click', function() {
      if (!confirm('Сбросить шаблон к стандартным цветам?')) return;
      currentData = DB.templates.getDefaultTemplate();
      updateScoreboardColors(currentData);
      applyPreview(currentData);
      closeColorPanel();
      showNotification('Шаблон сброшен. Нажмите "Сохранить" для применения.', 'success');
    });

    // ========================================================================
    // ЗАГРУЗКА И УДАЛЕНИЕ ЛОГОТИПА
    // ========================================================================

    // ОБРАБОТЧИК ЗАГРУЗКИ ЛОГОТИПА
    var logoUpload = $('#logoUpload');
    if (logoUpload) {
      logoUpload.on('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function(event) {
          var base64String = event.target.result;
          currentData.logo_base64 = base64String;
          applyPreview(currentData);
          
          var btnDeleteLogo = $('#btnDeleteLogo');
          if (btnDeleteLogo) {
            btnDeleteLogo.show();
          }
          showNotification('Логотип обновлён. Нажмите "Сохранить".', 'success');
        };
        reader.onerror = function() {
          showNotification('Ошибка чтения файла', 'error');
        };
        reader.readAsDataURL(file);
      });
    }

    // ОБРАБОТЧИК УДАЛЕНИЯ ЛОГОТИПА
    $('#btnDeleteLogo').on('click', function() {
      if (!confirm('Удалить собственный логотип из этого шаблона?')) return;
      currentData.logo_base64 = null;
      applyPreview(currentData);
      $(this).hide();
      showNotification('Логотип удалён. Нажмите "Сохранить".', 'success');
    });
  }

  // ============================================================================
  // ЗАПУСК
  // ============================================================================

  $(document).ready(function() {
    DB.init().then(function() {
      return AuthModule.checkAuth('admin', 'login.html');
    }).then(function(isAdmin) {
      if (isAdmin) {
        initPage();
      } else {
        $('#mainContainer').hide();
        $('#authDenied').show();
      }
    }).catch(function(err) {
      console.error('[Templates Visual] Init error:', err);
      $('#mainContainer').hide();
      $('#authDenied').show();
      $('#authDenied p').text('Ошибка инициализации: ' + (err.message || ''));
    });
  });

})();