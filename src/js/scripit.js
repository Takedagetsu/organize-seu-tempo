// ==================================================================
// 1. DADOS E REFERÊNCIAS DOS ELEMENTOS DO DOM
// ==================================================================
let tasks = []; // Array principal que conterá TODAS as tarefas COMPARTILHADAS
let taskIdCounter = 0; 
let loggedInUser = null; 
let users = {}; // Objeto que contém os usuários para autenticação

// Constantes de persistência
const USERS_DATA_KEY = 'takedaUsersData'; 

// Elementos de Interface
const loginContent = document.getElementById('login-content');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('login-message');

const userLogoffButton = document.getElementById('user-logoff-button'); 
const loggedInDisplayName = userLogoffButton; 

// Elementos Admin/Cadastro
const adminButton = document.querySelector('.admin-only'); 
const registerForm = document.getElementById('register-form');
const newUsernameInput = document.getElementById('new-username');
const newPasswordInput = document.getElementById('new-password');
const registerMessage = document.getElementById('register-message');
const userListElement = document.getElementById('user-list');

const headerNavigationGroup = document.querySelector('.header-navigation-group');

// Referências de Navegação e Conteúdo
const navButtons = document.querySelectorAll('.nav-button');
const contentSections = document.querySelectorAll('.content-section');
const taskList = document.getElementById('task-list'); 
const completedList = document.getElementById('completed-list'); 

// Inputs de Adição/Modal
const taskText = document.getElementById('task-text');
const taskDueDate = document.getElementById('task-due-date');
const taskPriority = document.getElementById('task-priority');
const addTaskBtn = document.getElementById('add-task-btn');
const editModal = document.getElementById('edit-modal');
const modalTaskTitle = document.getElementById('modal-task-title');
const modalAdditionalInfo = document.getElementById('modal-additional-info');
const modalPriority = document.getElementById('modal-priority');
const modalTaskId = document.getElementById('modal-task-id');
const saveEditBtn = document.getElementById('save-edit-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Elementos de Pesquisa
const searchForm = document.getElementById('search-form');
const searchText = document.getElementById('search-text');
const searchDate = document.getElementById('search-date');
const searchPriority = document.getElementById('search-priority');
const clearSearchBtn = document.getElementById('clear-search-btn');


// ==================================================================
// 2. LÓGICA DE PERSISTÊNCIA NA NUVEM (FIREBASE)
// ==================================================================

/**
 * Salva as tarefas e credenciais de usuário no Firebase.
 */
async function saveTasksToCloud() {
    // A variável global `database` é definida no index.html.
    await database.ref('sharedTasks').set(tasks);
    await database.ref('users').set(users);
}

/**
 * Carrega as tarefas do Firebase.
 */
async function getTasksFromCloud() {
    const tasksSnapshot = await database.ref('sharedTasks').once('value');
    const tasksData = tasksSnapshot.val();
    return tasksData ? tasksData : [];
}

/**
 * Carrega a lista de usuários para autenticação (mantendo o LocalStorage para fallback rápido).
 */
function loadUsersData() {
    const storedData = localStorage.getItem(USERS_DATA_KEY);
    
    if (storedData) {
        users = JSON.parse(storedData);
    } else {
        // Tenta carregar do Firebase se não houver dados locais
        database.ref('users').once('value').then(usersSnapshot => {
            const usersData = usersSnapshot.val();
            if (usersData) {
                users = usersData;
            } else {
                // Inicializa o TAKEDA se não houver dados em nenhum lugar
                users = { 'TAKEDA': { password: '147369' } }; 
            }
            saveUsersData(); // Salva no LocalStorage
        }).catch(error => {
            console.error("Erro ao carregar usuários do Firebase. Usando local.", error);
            users = { 'TAKEDA': { password: '147369' } }; 
            saveUsersData();
        });
    }
}

async function loadSharedTasks() {
    tasks = await getTasksFromCloud();
    
    if (tasks.length > 0) {
        const maxId = tasks.reduce((max, task) => task.id > max ? task.id : max, 0);
        taskIdCounter = maxId;
    } else {
        taskIdCounter = 0;
    }
    renderTasksToDOM(); 
}

function saveUsersData() {
    localStorage.setItem(USERS_DATA_KEY, JSON.stringify(users));
}

/**
 * Renderiza todas as tarefas, agrupadas em colunas por prioridade (pendentes) 
 * e em uma lista simples (concluídas).
 */
function renderTasksToDOM() {
    
    const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };

    const sortedPendingTasks = tasks
        .filter(task => !task.isCompleted)
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]); 

    const groupedTasks = sortedPendingTasks.reduce((acc, task) => {
        const priority = task.priority; 
        if (!acc[priority]) {
            acc[priority] = [];
        }
        acc[priority].push(task);
        return acc;
    }, {});
    
    taskList.innerHTML = ''; 
    completedList.innerHTML = ''; 

    const priorityKeys = Object.keys(priorityOrder).sort((a, b) => priorityOrder[a] - priorityOrder[b]);
    
    priorityKeys.forEach(priorityKey => {
        const tasksForPriority = groupedTasks[priorityKey] || [];

        if (tasksForPriority.length > 0) {
            const priorityNameDisplay = priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1);

            const columnDiv = document.createElement('div');
            columnDiv.className = 'priority-column';
            columnDiv.setAttribute('data-priority', priorityKey);

            const titleH2 = document.createElement('h2');
            titleH2.className = 'priority-column-title';
            titleH2.textContent = `Prioridade ${priorityNameDisplay}`;
            columnDiv.appendChild(titleH2);
            
            const taskContainerUl = document.createElement('ul');
            taskContainerUl.className = 'priority-task-list';

            tasksForPriority.forEach(task => {
                taskContainerUl.appendChild(createTaskElement(task));
            });

            columnDiv.appendChild(taskContainerUl);
            taskList.appendChild(columnDiv);
        }
    });

    renderCompletedTasks(); 
}

/**
 * Função que aplica a pesquisa e renderiza as tarefas concluídas.
 */
function renderCompletedTasks() {
    const allCompletedTasks = tasks.filter(task => task.isCompleted);
    let filteredTasks = allCompletedTasks;
    
    const textFilter = searchText.value.trim().toLowerCase();
    const dateFilter = searchDate.value;
    const priorityFilter = searchPriority.value;
    
    // Aplica filtros
    if (textFilter) {
        filteredTasks = filteredTasks.filter(task => 
            task.text.toLowerCase().includes(textFilter)
        );
    }

    if (dateFilter) {
        filteredTasks = filteredTasks.filter(task => 
            task.date === dateFilter
        );
    }

    if (priorityFilter) {
        filteredTasks = filteredTasks.filter(task => 
            task.priority === priorityFilter
        );
    }

    completedList.innerHTML = ''; 

    if (filteredTasks.length === 0 && (textFilter || dateFilter || priorityFilter)) {
        const message = document.createElement('p');
        message.className = 'error-message';
        message.textContent = 'Nenhuma tarefa concluída corresponde aos critérios de pesquisa.';
        completedList.appendChild(message);
        return;
    }
    
    filteredTasks.forEach(task => {
        completedList.appendChild(createTaskElement(task));
    });
}

function createTaskElement(taskData) {
    const { id, text, date, priority, isCompleted, lastModifiedBy, additionalInfo } = taskData;
    
    const li = document.createElement('li');
    li.id = `task-${id}`; 
    li.className = `task-item ${priority} ${isCompleted ? 'completed' : ''}`;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'task-text-clickable';
    textSpan.textContent = text;
    textSpan.addEventListener('click', () => openEditModal(id));
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'task-details';
    
    let infoDisplay = '';
    if (additionalInfo && additionalInfo.trim().length > 0) {
        infoDisplay = ' | Info Extra'; 
    }
    
    detailsDiv.innerHTML = `
        <p class="task-date">Vencimento: ${date || 'N/A'}</p>
        <p class="task-modified">Modificado por: ${lastModifiedBy || 'N/A'} ${infoDisplay}</p>
    `;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'task-controls';
    
    const isPrincipalAdmin = (loggedInUser === 'TAKEDA');

    if (!isCompleted) {
        // TAREFA PENDENTE
        
        const completeBtn = document.createElement('button');
        completeBtn.className = 'complete-btn';
        completeBtn.textContent = 'Concluir';
        completeBtn.addEventListener('click', completeTask);
        controlsDiv.appendChild(completeBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Excluir';
        deleteBtn.addEventListener('click', deleteTask);
        controlsDiv.appendChild(deleteBtn);

    } else {
        // TAREFA CONCLUÍDA
        
        const revertBtn = document.createElement('button');
        revertBtn.className = 'complete-btn'; 
        revertBtn.textContent = 'Reverter';
        revertBtn.addEventListener('click', uncompleteTask); 
        controlsDiv.appendChild(revertBtn);
        
        // REGRA CHAVE: Exibir Excluir APENAS se for o Admin (TAKEDA)
        if (isPrincipalAdmin) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Excluir';
            deleteBtn.addEventListener('click', deleteTask);
            controlsDiv.appendChild(deleteBtn);
        }
    }
    
    li.appendChild(textSpan);
    li.appendChild(detailsDiv);
    li.appendChild(controlsDiv); 
    
    return li;
}


// ==================================================================
// 3. LÓGICA DE CADASTRO E ADMIN
// ==================================================================

function handleRegistration(event) {
    event.preventDefault();

    const newUsername = newUsernameInput.value.trim();
    const newPassword = newPasswordInput.value;

    registerMessage.textContent = '';

    if (newUsername === '') {
        registerMessage.textContent = 'O nome de usuário não pode ser vazio.';
        return;
    }

    if (users[newUsername]) {
        registerMessage.textContent = 'Este usuário já existe.';
        return;
    }
    
    users[newUsername] = {
        password: newPassword,
    };
    saveUsersData();
    saveTasksToCloud(); // Sincroniza dados de usuário com a nuvem
    renderUserList();

    registerMessage.textContent = `Usuário "${newUsername}" cadastrado com sucesso!`;
    registerForm.reset();
}

function renderUserList() {
    userListElement.innerHTML = '';
    const userNames = Object.keys(users);

    userNames.forEach(name => {
        const li = document.createElement('li');
        const isPrincipal = (name === 'TAKEDA');
        const isCurrentUser = (name === loggedInUser);
        
        li.setAttribute('data-username', name);
        if (isCurrentUser) {
            li.setAttribute('data-current-user', 'true');
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'user-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-user-btn';
        editBtn.textContent = 'Modificar';
        if (!isPrincipal && !isCurrentUser) {
            editBtn.onclick = () => openUserEditModal(name);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-user-btn';
        deleteBtn.textContent = 'Excluir';
        if (!isPrincipal && !isCurrentUser) {
            deleteBtn.onclick = () => deleteUser(name);
        }

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = isPrincipal ? `${name} (Principal)` : name;

        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);
        userListElement.appendChild(li);
    });
}

function checkAdminVisibility() {
    if (loggedInUser === 'TAKEDA') {
        adminButton.style.display = 'block';
    } else {
        adminButton.style.display = 'none';
    }
}

function openUserEditModal(username) {
    editModal.style.display = 'flex';
    modalTaskTitle.textContent = `Modificar Senha de: ${username}`;

    document.getElementById('modal-additional-info').value = '';
    document.getElementById('modal-additional-info').placeholder = 'Nova Senha';
    
    document.getElementById('modal-priority').style.display = 'none'; 
    document.querySelector('label[for="modal-priority"]').style.display = 'none';

    document.getElementById('modal-task-id').value = username; 
    
    saveEditBtn.onclick = saveUserEdit;
    closeModalBtn.onclick = resetAndCloseUserModal;
}

async function saveUserEdit() {
    const username = document.getElementById('modal-task-id').value;
    const newPassword = document.getElementById('modal-additional-info').value.trim();

    if (newPassword === '') {
        alert("A senha não pode ser vazia.");
        return;
    }

    if (users[username]) {
        users[username].password = newPassword;
        saveUsersData();
        await saveTasksToCloud(); // Sincroniza credenciais
        alert(`Senha do usuário "${username}" alterada com sucesso!`);
    }

    resetAndCloseUserModal();
    renderUserList(); 
}

async function deleteUser(username) {
    if (confirm(`Tem certeza que deseja EXCLUIR o usuário "${username}"? Todas as tarefas dele serão perdidas.`)) {
        delete users[username];
        saveUsersData();
        
        tasks = tasks.filter(task => task.lastModifiedBy !== username);
        
        await saveTasksToCloud(); // Sincroniza exclusão de usuário/tarefas na nuvem
        
        renderUserList();
        renderTasksToDOM(); 
    }
}

function resetAndCloseUserModal() {
    editModal.style.display = 'none';
    
    document.getElementById('modal-additional-info').placeholder = 'Adicione notas, links ou detalhes extras...';
    document.getElementById('modal-priority').style.display = 'block';
    document.querySelector('label[for="modal-priority"]').style.display = 'block';
    
    saveEditBtn.onclick = saveEdit; 
    closeModalBtn.onclick = closeEditModal;
}


// ==================================================================
// 4. FUNÇÕES DE AUTENTICAÇÃO E CRUD (AJUSTADAS PARA ASYNC)
// ==================================================================

function handleLogin(event) {
    event.preventDefault();

    const user = usernameInput.value.trim();
    const pass = passwordInput.value;

    loginMessage.textContent = '';

    if (!users[user] || users[user].password !== pass) {
        loginMessage.textContent = 'Usuário ou senha inválidos. Tente novamente.';
        return;
    }
    
    loggedInUser = user;
    
    loginContent.style.display = 'none';
    appContent.style.display = 'flex'; 
    
    if (headerNavigationGroup) {
        headerNavigationGroup.style.display = 'flex';
    }
    
    loginForm.reset();
    
    loggedInDisplayName.textContent = `${loggedInUser} (Sair)`;
    loggedInDisplayName.style.display = 'block';

    loadSharedTasks(); 
    
    checkAdminVisibility();
    renderUserList();

    changeContent('add-task-content');
}

function handleLogoff() {
    loggedInUser = null; 
    
    appContent.style.display = 'none';

    loggedInDisplayName.textContent = '';
    loggedInDisplayName.style.display = 'none';

    if (headerNavigationGroup) {
        headerNavigationGroup.style.display = 'none';
    }

    loginContent.style.display = 'flex';
    
    usernameInput.value = '';
    passwordInput.value = '';
}

function changeContent(targetContentId) {
    navButtons.forEach(btn => btn.classList.remove('active'));
    contentSections.forEach(content => content.classList.remove('active'));

    const targetButton = document.querySelector(`.nav-button[data-content="${targetContentId}"]`);
    const targetContent = document.getElementById(targetContentId);

    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');
    }
    
    if (targetContentId === 'completed-tasks-content') {
        renderCompletedTasks();
    }
}

function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    resetAndCloseUserModal(); 

    if (task.isCompleted) {
        document.getElementById('modal-priority').style.display = 'none'; 
        document.querySelector('label[for="modal-priority"]').style.display = 'none';
    } else {
        document.getElementById('modal-priority').style.display = 'block'; 
        document.querySelector('label[for="modal-priority"]').style.display = 'block';
    }

    modalTaskTitle.textContent = task.text;
    modalAdditionalInfo.value = task.additionalInfo || '';
    modalPriority.value = task.priority;
    modalTaskId.value = taskId; 
    
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
}

async function saveEdit() {
    const taskId = parseInt(modalTaskId.value);
    const newAdditionalInfo = modalAdditionalInfo.value.trim();
    const newPriority = modalPriority.value;

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    tasks[taskIndex].additionalInfo = newAdditionalInfo;
    
    if (!tasks[taskIndex].isCompleted) {
        tasks[taskIndex].priority = newPriority;
    }

    tasks[taskIndex].lastModifiedBy = loggedInUser; 
    tasks[taskIndex].lastModifiedDate = new Date().toLocaleString('pt-BR');

    await saveTasksToCloud(); 
    renderTasksToDOM(); 
    
    closeEditModal();
}

async function addTask() {
    const text = taskText.value.trim();
    const date = taskDueDate.value;
    const priority = taskPriority.value;

    if (text === '') {
        alert('Por favor, descreva a tarefa antes de adicionar.');
        return;
    }
    
    taskIdCounter++;

    const newTaskData = {
        id: taskIdCounter,
        text,
        date,
        priority,
        additionalInfo: '',
        isCompleted: false,
        lastModifiedBy: loggedInUser,
        lastModifiedDate: new Date().toLocaleString('pt-BR')
    };

    tasks.push(newTaskData);

    await saveTasksToCloud(); 
    renderTasksToDOM(); 

    taskText.value = '';
    taskDueDate.value = '';
    taskPriority.value = 'low';
    
    changeContent('pending-tasks-content');
}

async function completeTask(event) {
    const taskId = parseInt(event.target.closest('.task-item').id.replace('task-', ''));
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isCompleted = true;
        task.lastModifiedBy = loggedInUser;
        task.lastModifiedDate = new Date().toLocaleString('pt-BR');
    }
    
    await saveTasksToCloud(); 
    renderTasksToDOM(); 
}

async function uncompleteTask(event) {
    const taskId = parseInt(event.target.closest('.task-item').id.replace('task-', ''));
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isCompleted = false;
        task.lastModifiedBy = loggedInUser;
        task.lastModifiedDate = new Date().toLocaleString('pt-BR');
    }
    
    await saveTasksToCloud(); 
    renderTasksToDOM(); 
}

async function deleteTask(event) {
    const taskItem = event.target.closest('.task-item');
    const taskId = parseInt(taskItem.id.replace('task-', ''));
    const task = tasks.find(t => t.id === taskId);

    if (task.isCompleted && loggedInUser !== 'TAKEDA') {
        alert("Apenas a conta principal (TAKEDA) pode excluir tarefas concluídas.");
        return; 
    }

    if (!taskItem) return;

    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
        tasks = tasks.filter(t => t.id !== taskId);
        
        await saveTasksToCloud(); 
        renderTasksToDOM(); 
    }
}


// ==================================================================
// 8. EVENT LISTENERS GERAIS E INICIALIZAÇÃO
// ==================================================================

loginForm.addEventListener('submit', handleLogin);
userLogoffButton.addEventListener('click', handleLogoff); 
registerForm.addEventListener('submit', handleRegistration);

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetContentId = button.getAttribute('data-content');
        changeContent(targetContentId);
    });
});

addTaskBtn.addEventListener('click', addTask);
saveEditBtn.onclick = saveEdit;
closeModalBtn.onclick = closeEditModal;

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    renderCompletedTasks(); 
});

clearSearchBtn.addEventListener('click', () => {
    searchForm.reset();
    renderCompletedTasks(); 
});


document.addEventListener('DOMContentLoaded', () => {
    loadUsersData(); 
    loadSharedTasks(); 
    
    appContent.style.display = 'none';
    loginContent.style.display = 'flex';
    
    if (headerNavigationGroup) {
        headerNavigationGroup.style.display = 'none';
    }
});
