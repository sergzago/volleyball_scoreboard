/**
 * Скрипт для исправления типа коллекции scoreusers на 'auth'
 * Запускать только с сервера, где есть доступ к PocketBase без CORS
 */

const CONFIG = {
  url: process.env.POCKETBASE_URL || 'http://zago.my.to:8091',
  adminEmail: process.env.POCKETBASE_ADMIN_EMAIL || 'supervisor@volleyball.local',
  adminPassword: process.env.POCKETBASE_ADMIN_PASSWORD || 'Mer1in00'
};

async function fixScoreusersCollection() {
  const { default: PocketBase } = await import('pocketbase');
  const pb = new PocketBase(CONFIG.url);

  try {
    console.log('Авторизация как администратор...');
    await pb.admins.authWithPassword(CONFIG.adminEmail, CONFIG.adminPassword);
    console.log('✓ Авторизация успешна\n');

    // Получаем все коллекции
    const collections = await pb.collections.getList();
    const scoreusers = collections.find(c => c.name === 'scoreusers');

    if (!scoreusers) {
      console.error('✗ Коллекция scoreusers не найдена!');
      console.log('Создаю новую auth коллекцию scoreusers...');
      
      await pb.collections.create({
        name: 'scoreusers',
        type: 'auth',
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        createRule: '',
        updateRule: 'id = @request.auth.id',
        deleteRule: null,
        schema: [
          { name: 'username', type: 'text', required: true, unique: true, min: 3, max: 50 },
          { name: 'name', type: 'text', required: false, max: 100 },
          { name: 'role', type: 'select', required: false, maxSelect: 1, values: ['admin', 'user', 'moderator'] },
          { name: 'avatar', type: 'file', required: false, maxSelect: 1, mimeTypes: ['image/jpeg', 'image/png', 'image/gif'], thumbs: ['100x100'] }
        ],
        options: {
          allowEmailAuth: true,
          allowOAuth2Auth: true,
          allowUsernameAuth: true,
          minPasswordLength: 8,
          requireEmail: false,
          onlyVerified: false
        }
      });
      console.log('✓ Коллекция scoreusers создана как auth\n');
      return;
    }

    console.log('Текущий тип коллекции scoreusers:', scoreusers.type);

    if (scoreusers.type === 'auth') {
      console.log('✓ Коллекция scoreusers уже имеет тип auth');
      console.log('\nЕсли пароли хранятся в открытом виде, значит пользователи были');
      console.log('созданы неправильно. Нужно пересоздать их через auth API.\n');
      
      // Проверяем существующих пользователей
      const users = await pb.collection('scoreusers').getFullList();
      console.log('Существующие пользователи:', users.length);
      
      if (users.length > 0) {
        console.log('\nПользователи:');
        users.forEach(u => {
          console.log(`  - ${u.username} (${u.email}) — роль: ${u.role || 'user'}`);
          // Проверяем есть ли поле password в открытом виде
          if (u.password && u.password !== '') {
            console.log('    ⚠️ ВНИМАНИЕ: Пароль хранится в открытом виде!');
          }
        });
        
        console.log('\nДля исправления:');
        console.log('1. Удалите пользователей с открытыми паролями');
        console.log('2. Создайте их заново через DB.auth.createUser()');
        console.log('   или через pb.collection("scoreusers").create({password: "...", passwordConfirm: "..."})\n');
      }
      
      return;
    }

    // Коллекция имеет тип 'base' — нужно удалить и создать заново как auth
    console.log('\n⚠️ Коллекция scoreusers имеет тип "base" вместо "auth"');
    console.log('Пароли НЕ хешируются!\n');
    
    console.log('ВНИМАНИЕ: Для исправления нужно:');
    console.log('1. Удалить коллекцию scoreusers (все пользователи будут удалены)');
    console.log('2. Создать новую коллекцию scoreusers с типом auth\n');

    // Проверяем есть ли пользователи
    const users = await pb.collection('scoreusers').getFullList();
    if (users.length > 0) {
      console.log('⚠️ В коллекции есть пользователи:', users.length);
      console.log('Перед удалением сохраните данные:\n');
      users.forEach(u => {
        console.log(`  - ${u.username} (${u.email}) — роль: ${u.role || 'user'}`);
      });
      console.log('');
    }

    // Удаляем и создаём заново
    console.log('Удаление коллекции scoreusers...');
    await pb.collections.delete(scoreusers.id);
    console.log('✓ Удалено\n');

    console.log('Создание auth коллекции scoreusers...');
    await pb.collections.create({
      name: 'scoreusers',
      type: 'auth',
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: '',
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      schema: [
        { name: 'username', type: 'text', required: true, unique: true, min: 3, max: 50 },
        { name: 'name', type: 'text', required: false, max: 100 },
        { name: 'role', type: 'select', required: false, maxSelect: 1, values: ['admin', 'user', 'moderator'] },
        { name: 'avatar', type: 'file', required: false, maxSelect: 1, mimeTypes: ['image/jpeg', 'image/png', 'image/gif'], thumbs: ['100x100'] }
      ],
      options: {
        allowEmailAuth: true,
        allowOAuth2Auth: true,
        allowUsernameAuth: true,
        minPasswordLength: 8,
        requireEmail: false,
        onlyVerified: false
      }
    });
    console.log('✓ Коллекция scoreusers создана как auth\n');

    console.log('✓ Исправление завершено!');
    console.log('Теперь создайте пользователей через DB.auth.createUser()\n');

  } catch (err) {
    console.error('\n✗ Ошибка:', err.message);
    process.exit(1);
  }
}

fixScoreusersCollection();
