/**
 * Управление цветовыми шаблонами табло
 *
 * Страница: templates.html
 * Зависимости: credentials.js, db-config.js, db-interface.js, auth.js
 *
 * Предоставляет:
 * - Загрузку и отображение цветовых схем для классического и пляжного волейбола
 * - Real-time preview при изменении цветов
 * - Сохранение шаблонов в БД
 * - Сброс к дефолтным цветам
 */

(function() {
  'use strict';

  // ============================================================================
  // СОСТОЯНИЕ
  // ============================================================================

  /** @type {Object} Кэш загруженных данных шаблонов */
  var templateCache = {};

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================================================

  /**
   * Собирает все значения color picker'ов из указанной формы
   * @param {string} templateId - ID шаблона ('default_classic' или 'default_beach')
   * @returns {Object} - объект со свойствами цветовой схемы
   */
  function collectFormData(templateId) {
    var formId = templateId === 'default_classic' ? '#classic-template-form' : '#beach-template-form';
    var data = {};

    $(formId).find('input[type="color"][data-style-property]').each(function() {
      var property = $(this).data('style-property');
      data[property] = $(this).val();
    });

    return data;
  }

  /**
   * Заполняет color picker'ы формы значениями из объекта данных
   * @param {string} templateId
   * @param {Object} data - цветовая схема
   */
  function populateForm(templateId, data) {
    var formId = templateId === 'default_classic' ? '#classic-template-form' : '#beach-template-form';

    $(formId).find('input[type="color"][data-style-property]').each(function() {
      var property = $(this).data('style-property');
      if (data[property]) {
        $(this).val(data[property]);
      }
    });
  }

  /**
   * Показывает уведомление пользователю
   * @param {string} message - текст уведомления
   * @param {string} type - 'success' | 'error'
   */
  function showNotification(message, type) {
    type = type || 'success';

    // Удаляем предыдущее уведомление если есть
    $('.template-notification').remove();

    var bgColor = type === 'success' ? '#28a745' : '#dc3545';
    var $notif = $('<div class="template-notification">')
      .text(message)
      .css({
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 24px',
        background: bgColor,
        color: '#fff',
        borderRadius: '4px',
        fontSize: '16px',
        fontWeight: 'bold',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        opacity: 0,
        transition: 'opacity 0.3s ease'
      })
      .appendTo('body');

    // Анимация появления
    setTimeout(function() {
      $notif.css('opacity', 1);
    }, 50);

    // Автоматическое скрытие через 3 секунды
    setTimeout(function() {
      $notif.css('opacity', 0);
      setTimeout(function() {
        $notif.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Применяет цветовую схему для preview через applyTemplate()
   * @param {Object} data - цветовая схема
   */
  function applyPreview(data) {
    // applyTemplate определена в scoreboard.js
    if (typeof applyTemplate === 'function') {
      applyTemplate(data);
    }
  }

  // ============================================================================
  // ЗАГРУЗКА ШАБЛОНА
  // ============================================================================

  /**
   * Загружает данные шаблона из БД и заполняет форму
   * @param {string} templateId
   * @param {string} formSelector - CSS селектор формы
   * @param {boolean} applyToPreview - применить ли схему для preview
   * @returns {Promise}
   */
  function loadTemplate(templateId, formSelector, applyToPreview) {
    return DB.templates.get(templateId).then(function(data) {
      var templateData = data || DB.templates.getDefaultTemplate(templateId);

      // Кэшируем
      templateCache[templateId] = templateData;

      // Заполняем форму
      populateForm(templateId, templateData);

      // Применяем для preview если нужно
      if (applyToPreview) {
        applyPreview(templateData);
      }

      console.log('[Templates] Loaded template:', templateId, templateData);
    }).catch(function(err) {
      console.error('[Templates] Error loading template:', templateId, err);
      // При ошибке используем дефолтные значения
      var defaults = DB.templates.getDefaultTemplate(templateId);
      templateCache[templateId] = defaults;
      populateForm(templateId, defaults);
    });
  }

  // ============================================================================
  // ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
  // ============================================================================

  function initTemplatesPage() {
    console.log('[Templates] Initializing templates page');

    // Показываем основной контейнер, скрываем блок отказа в доступе
    $('#mainContainer').show();
    $('#authDenied').hide();

    // Загружаем оба шаблона
    // Для preview применяем классический (первый загруженный)
    Promise.all([
      loadTemplate('default_classic', '#classic-template-form', true),
      loadTemplate('default_beach', '#beach-template-form', false)
    ]).then(function() {
      console.log('[Templates] Both templates loaded');
    });

    // ==========================================================================
    // REAL-TIME PREVIEW
    // ==========================================================================

    // При изменении любого color picker'а обновляем preview
    $('input[type="color"][data-style-property]').on('input', function() {
      var $form = $(this).closest('.template-form');
      var templateId = $form.find('.btn-save').data('template-id');

      // Собираем текущие значения из формы
      var currentData = collectFormData(templateId);

      // Обновляем кэш
      templateCache[templateId] = currentData;

      // Применяем для preview
      applyPreview(currentData);
    });

    // ==========================================================================
    // СОХРАНЕНИЕ
    // ==========================================================================

    $('.btn-save').on('click', function() {
      var templateId = $(this).data('template-id');
      var data = collectFormData(templateId);

      // Блокируем кнопку на время сохранения
      var $btn = $(this);
      $btn.prop('disabled', true).text('Сохранение...');

      DB.templates.update(templateId, data).then(function() {
        console.log('[Templates] Template saved:', templateId, data);
        templateCache[templateId] = data;
        showNotification('Шаблон "' + templateId + '" сохранен', 'success');
      }).catch(function(err) {
        console.error('[Templates] Error saving template:', templateId, err);
        showNotification('Ошибка сохранения шаблона: ' + (err.message || 'неизвестная ошибка'), 'error');
      }).finally(function() {
        $btn.prop('disabled', false).text('Сохранить');
      });
    });

    // ==========================================================================
    // СБРОС
    // ==========================================================================

    $('.btn-reset').on('click', function() {
      var templateId = $(this).data('template-id');
      var defaults = DB.templates.getDefaultTemplate(templateId);

      if (confirm('Сбросить шаблон "' + templateId + '" к стандартным цветам?')) {
        // Заполняем форму дефолтными значениями
        populateForm(templateId, defaults);
        templateCache[templateId] = defaults;

        // Применяем для preview
        applyPreview(defaults);

        showNotification('Шаблон сброшен к стандартным цветам. Нажмите "Сохранить" для применения.', 'success');
      }
    });
  }

  // ============================================================================
  // ЗАПУСК
  // ============================================================================

  $(document).ready(function() {
    // Сначала инициализируем DB
    DB.init().then(function() {
      // Проверка авторизации (только admin)
      // checkAuth сама вызовет DB.init() повторно, но это безопасно
      return AuthModule.checkAuth('admin', 'login.html');
    }).then(function(isAdmin) {
      if (isAdmin) {
        initTemplatesPage();
      } else {
        // Показываем блок "Доступ запрещен"
        $('#mainContainer').hide();
        $('#authDenied').show();
      }
    }).catch(function(err) {
      console.error('[Templates] Initialization failed:', err);
      $('#mainContainer').hide();
      $('#authDenied').show();
      $('#authDenied p').text('Ошибка инициализации: ' + (err.message || ''));
    });
  });

})();