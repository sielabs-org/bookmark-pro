import { getCategories, addCategory, getBookmarks, addBookmark, deleteBookmark, deleteCategory, moveBookmark, updateBookmark, moveCategory } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });

    const categoryListEl = document.getElementById('category-list');
    const bookmarkGridEl = document.getElementById('bookmark-grid');
    const pageTitleEl = document.getElementById('page-title');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const modalEl = document.getElementById('modal');
    const modalTitleEl = document.getElementById('modal-title');
    const modalFormEl = document.getElementById('modal-form');
    let currentCategoryId = 'all';
    let currentSearchQuery = '';

    // Shortcut Hint
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutText = isMac ? 'Option+O' : 'Alt+O';
    const shortcutEl = document.getElementById('sidebar-shortcut');
    if (shortcutEl) shortcutEl.textContent = shortcutText;

    const renderView = () => {
        return renderCategories()
            .then(() => renderBookmarks(currentCategoryId))
            .catch((error) => {
                showMoveError('Failed to render categories', error);
            });
    };

    // Initial Load
    await renderView();


    const searchInput = document.getElementById('search-input');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');

    // Theme Management
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // Event Listeners
    addCategoryBtn.addEventListener('click', () => openModal('category'));
    addBookmarkBtn.addEventListener('click', () => openModal('bookmark'));

    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        renderBookmarks(currentCategoryId);
    });

    // Close modal when clicking outside
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
    });

    // Listen for storage changes to refresh UI (e.g. when background syncs deletions)
    // Listen for bookmark changes to refresh UI interactively
    let refreshTimeout;
    const refreshUI = () => {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
            renderView();
        }, 50); // Debounce to prevent multiple renders on bulk operations
    };

    chrome.bookmarks.onCreated.addListener(refreshUI);
    chrome.bookmarks.onRemoved.addListener(refreshUI);
    chrome.bookmarks.onChanged.addListener(refreshUI);
    chrome.bookmarks.onMoved.addListener(refreshUI);
    chrome.bookmarks.onChildrenReordered.addListener(refreshUI);


    function getBookmarkImage(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                let videoId = null;
                if (hostname.includes('youtu.be')) {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    videoId = urlObj.searchParams.get('v');
                }

                if (videoId) {
                    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
            }

            return `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
        } catch (e) {
            return 'https://via.placeholder.com/150';
        }
    }

    function getHostname(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return url;
        }
    }

    function getErrorMessage(error) {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        try {
            return JSON.stringify(error);
        } catch (e) {
            return String(error);
        }
    }

    function showUserMessage(message) {
        try {
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert(message);
                return;
            }
        } catch (dialogError) {
            console.warn('Unable to show alert dialog:', dialogError);
        }
        console.warn(message);
    }

    function showMoveError(prefix, error) {
        let details = 'Unknown error';
        try {
            details = getErrorMessage(error);
        } catch (parseError) {
            console.error('Failed to parse move error:', parseError);
        }
        console.error(prefix, error);
        showUserMessage(`${prefix}: ${details}`);
    }

    function closestFromTarget(target, selector) {
        return target instanceof Element ? target.closest(selector) : null;
    }

    async function renderCategories() {
        try {
            const categories = await getCategories();
            categoryListEl.innerHTML = '';
        const parentByCategoryId = categories.reduce((acc, item) => {
            acc[item.id] = item.parentId;
            return acc;
        }, {});
        const movableCategoriesByParent = categories.reduce((acc, item) => {
            if (!item.deletable) return acc;
            if (!acc[item.parentId]) acc[item.parentId] = [];
            acc[item.parentId].push(item);
            return acc;
        }, {});
        Object.values(movableCategoriesByParent).forEach((items) => {
            items.sort((a, b) => a.index - b.index);
        });

        const moveCategoryByStep = async (cat, direction) => {
            const siblings = movableCategoriesByParent[cat.parentId] || [];
            const currentPosition = siblings.findIndex((sibling) => sibling.id === cat.id);
            if (currentPosition < 0) return;
            const targetPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1;
            const targetSibling = siblings[targetPosition];
            if (!targetSibling) return;

            let targetIndex = direction === 'up' ? targetSibling.index : targetSibling.index + 1;
            if (cat.index < targetIndex) {
                targetIndex--;
            }

            await moveCategory(cat.id, cat.parentId, targetIndex);
        };

        const createsCycle = (dragCategoryId, newParentId) => {
            let currentParent = newParentId;
            while (currentParent && currentParent !== '0') {
                if (currentParent === dragCategoryId) return true;
                currentParent = parentByCategoryId[currentParent];
            }
            return false;
        };

        // "All Bookmarks" Item
        const allLi = document.createElement('li');
        allLi.className = `category-item ${currentCategoryId === 'all' ? 'active' : ''}`;
        allLi.dataset.id = 'all';
        allLi.innerHTML = '<span class="category-name">All Bookmarks</span>';

        allLi.addEventListener('click', () => {
            currentCategoryId = 'all';
            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
            allLi.classList.add('active');
            pageTitleEl.textContent = 'All Bookmarks';
            renderBookmarks('all');
        });

        // Allow dropping on "All" (optional, maybe not needed if it just means no change?) 
        // But real categories need drop zones.

        categoryListEl.appendChild(allLi);

            categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = `category-item ${currentCategoryId === cat.id ? 'active' : ''}`;
            li.dataset.id = cat.id;

            if (cat.deletable) {
                li.draggable = true;
            }

            const siblings = movableCategoriesByParent[cat.parentId] || [];
            const currentPosition = siblings.findIndex((sibling) => sibling.id === cat.id);
            const canMoveUp = currentPosition > 0;
            const canMoveDown = currentPosition >= 0 && currentPosition < siblings.length - 1;

            if (cat.deletable) {
                const handleEl = document.createElement('span');
                handleEl.className = 'category-handle';
                handleEl.setAttribute('aria-hidden', 'true');
                handleEl.textContent = '::';
                li.appendChild(handleEl);
            }

            const nameEl = document.createElement('span');
            nameEl.className = 'category-name';
            nameEl.textContent = cat.name;
            li.appendChild(nameEl);

            let moveUpBtn = null;
            let moveDownBtn = null;

            if (cat.deletable) {
                const actionsEl = document.createElement('div');
                actionsEl.className = 'category-actions';

                moveUpBtn = document.createElement('button');
                moveUpBtn.type = 'button';
                moveUpBtn.className = 'category-move-btn move-up';
                moveUpBtn.title = 'Move Up';
                moveUpBtn.setAttribute('aria-label', 'Move category up');
                moveUpBtn.textContent = '▲';
                moveUpBtn.disabled = !canMoveUp;

                moveDownBtn = document.createElement('button');
                moveDownBtn.type = 'button';
                moveDownBtn.className = 'category-move-btn move-down';
                moveDownBtn.title = 'Move Down';
                moveDownBtn.setAttribute('aria-label', 'Move category down');
                moveDownBtn.textContent = '▼';
                moveDownBtn.disabled = !canMoveDown;

                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'delete-cat';
                deleteBtn.title = 'Delete Category';
                deleteBtn.setAttribute('aria-label', 'Delete category');
                deleteBtn.textContent = 'x';

                actionsEl.appendChild(moveUpBtn);
                actionsEl.appendChild(moveDownBtn);
                actionsEl.appendChild(deleteBtn);
                li.appendChild(actionsEl);
            }

            if (moveUpBtn) {
                moveUpBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCategoryByStep(cat, 'up').catch((error) => {
                        showMoveError('Could not move category up', error);
                    });
                });
            }
            if (moveDownBtn) {
                moveDownBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    moveCategoryByStep(cat, 'down').catch((error) => {
                        showMoveError('Could not move category down', error);
                    });
                });
            }

            // Drag Start
            li.addEventListener('dragstart', (e) => {
                if (!cat.deletable) {
                    e.preventDefault();
                    return;
                }
                if (closestFromTarget(e.target, '.category-actions')) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('category-id', cat.id);
                e.dataTransfer.setData('source-index', cat.index);
                e.dataTransfer.setData('source-parent', cat.parentId);
                e.dataTransfer.effectAllowed = 'move';
                li.classList.add('dragging-cat');
                e.stopPropagation();
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging-cat');
                document.querySelectorAll('.category-item').forEach(el => {
                    el.classList.remove('drop-before', 'drop-after', 'drag-over');
                });
            });

            // Drop Zone Logic
            li.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary for drop to work

                const dragType = e.dataTransfer.types.includes('category-id') ? 'category' : 'bookmark';

                if (dragType === 'category') {
                    // For category reordering, show before/after indicator
                    const bounding = li.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);

                    if (e.clientY - offset > 0) {
                        li.classList.add('drop-after');
                        li.classList.remove('drop-before');
                    } else {
                        li.classList.add('drop-before');
                        li.classList.remove('drop-after');
                    }
                } else {
                    // For bookmark dropping, show full highlight
                    li.classList.add('drag-over');
                }
            });
            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over', 'drop-before', 'drop-after');
            });
            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over', 'drop-before', 'drop-after');

                Promise.resolve().then(async () => {
                    const bookmarkId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
                    const dragCatId = e.dataTransfer ? e.dataTransfer.getData('category-id') : '';
                    if (dragCatId) {
                        // Category reordering logic
                        if (dragCatId === cat.id) return; // Dropped on itself
                        if (createsCycle(dragCatId, cat.parentId)) {
                            showUserMessage('Cannot move a category into itself or its nested subcategory.');
                            return;
                        }

                        const sourceParent = e.dataTransfer.getData('source-parent');
                        let targetIndex = cat.index;

                        const bounding = li.getBoundingClientRect();
                        const offset = bounding.y + (bounding.height / 2);
                        if (e.clientY - offset > 0) {
                            // Drop After
                            targetIndex++;
                        }

                        const sourceIndex = parseInt(e.dataTransfer.getData('source-index'), 10);
                        // Adjust index if moving within the same folder and moving downward
                        if (sourceParent === cat.parentId && sourceIndex < targetIndex) {
                            targetIndex--;
                        }

                        await moveCategory(dragCatId, cat.parentId, targetIndex);
                        // Notice: UI will refresh via chrome.bookmarks.onMoved
                    } else if (bookmarkId) {
                        // Bookmark moving logic
                        await moveBookmark(bookmarkId, cat.id);
                    }
                }).catch((error) => {
                    showMoveError('Could not move item', error);
                });
            });

            li.addEventListener('click', (e) => {
                // Determine if delete was clicked
                if (closestFromTarget(e.target, '.delete-cat')) {
                    if (confirm(`Are you sure you want to delete folder "${cat.name}" and all its contents?`)) {
                        deleteCategory(cat.id).then(() => {
                            if (currentCategoryId === cat.id) currentCategoryId = 'all';
                            // render handled by event listeners? 
                            // Yes, chrome.bookmarks.onRemoved will fire.
                        }).catch(err => {
                            console.error('Delete failed:', err);
                            showUserMessage('Failed to delete category. System folders cannot be deleted.');
                        });
                    }
                    return;
                }
                if (closestFromTarget(e.target, '.category-move-btn')) return;

                currentCategoryId = cat.id;
                document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                pageTitleEl.textContent = cat.name;
                renderBookmarks(cat.id);
            });

                categoryListEl.appendChild(li);
            });
        } catch (error) {
            console.error('renderCategories failed:', error);
            showUserMessage(`Failed to render categories: ${getErrorMessage(error)}`);
        }
    }

    function getGradient(str) {
        const gradients = [
            'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)', // Pinky
            'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', // Aqua
            'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', // Lavender
            'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)', // Rose
            'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', // Sunset
            'linear-gradient(120deg, #d299c2 0%, #fef9d7 100%)', // Magic
            'linear-gradient(120deg, #89f7fe 0%, #66a6ff 100%)', // Blue
            'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)', // Cloud
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % gradients.length;
        return gradients[index];
    }

    async function renderBookmarks(categoryId) {
        try {
            let bookmarks = await getBookmarks();
            if (categoryId !== 'all') {
                bookmarks = bookmarks.filter(b => b.categoryId === categoryId);
            }

            if (currentSearchQuery) {
                bookmarks = bookmarks.filter(b =>
                    b.title.toLowerCase().includes(currentSearchQuery) ||
                    b.url.toLowerCase().includes(currentSearchQuery)
                );
            }

            bookmarkGridEl.innerHTML = '';
            bookmarks.forEach(bm => {
            const imgUrl = getBookmarkImage(bm.url);
            const isFavicon = imgUrl.includes('google.com/s2/favicons');
            const bgStyle = isFavicon ? `background: ${getGradient(bm.title)};` : 'background: #F4F5F7;';

            const a = document.createElement('a');
            a.className = 'bookmark-card';
            a.href = bm.url;
            a.target = '_blank';
            a.draggable = true; // Enable drag
            a.dataset.id = bm.id;

            a.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', bm.id);
                a.classList.add('dragging');
            });

            a.addEventListener('dragend', () => {
                a.classList.remove('dragging');
            });

            a.innerHTML = `
                <div class="bookmark-visual" style="${bgStyle}">
                    <img src="${imgUrl}" alt="${bm.title}" class="${isFavicon ? 'is-favicon' : ''}">
                </div>
                <div class="bookmark-info">
                    <div class="bookmark-title">${bm.title}</div>
                    <div class="bookmark-meta">
                        <span class="bookmark-hostname">${getHostname(bm.url)}</span>
                    </div>
                </div>
            `;

            // Handle image error for CSP compliance
            const img = a.querySelector('img');
            img.addEventListener('error', () => {
                img.src = 'https://via.placeholder.com/150';
            });

            const footer = document.createElement('div');
            footer.className = 'bookmark-footer';

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn copy-btn';
            copyBtn.title = 'Copy Link';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
                </svg>
            `;
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(bm.url).then(() => {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
                    setTimeout(() => copyBtn.innerHTML = originalHtml, 2000);
                });
            };

            // Edit Button
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit-btn';
            editBtn.title = 'Edit';
            editBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                   <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
            `;
            editBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal('bookmark', bm);
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn delete-btn';
            delBtn.title = 'Delete';
            delBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                   <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            `;
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this bookmark?')) {
                    deleteBookmark(bm.id).then(() => renderBookmarks(currentCategoryId));
                }
            };

            footer.appendChild(copyBtn);
            footer.appendChild(editBtn);
            footer.appendChild(delBtn);
            a.appendChild(footer);

                bookmarkGridEl.appendChild(a);
            });
        } catch (error) {
            console.error('renderBookmarks failed:', error);
            showUserMessage(`Failed to render bookmarks: ${getErrorMessage(error)}`);
        }
    }

    function openModal(type, existingItem = null) {
        modalEl.classList.add('open');
        modalFormEl.innerHTML = '';

        if (type === 'category') {
            modalTitleEl.textContent = 'New Category';
            modalFormEl.innerHTML = `
                <div class="input-group">
                    <input type="text" id="cat-name" placeholder="Category Name" required>
                </div>
                <button type="submit" class="btn">Create</button>
            `;
            modalFormEl.onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('cat-name').value;
                await addCategory({ name });
                closeModal();
                renderCategories();
            };
        } else {
            const isEdit = !!existingItem;
            modalTitleEl.textContent = isEdit ? 'Edit Bookmark' : 'New Bookmark';
            // We need to fetch categories to populate the select
            getCategories().then(categories => {
                let options = categories.map(c => `<option value="${c.id}" ${isEdit && existingItem.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
                modalFormEl.innerHTML = `
                    <div class="input-group">
                        <input type="text" id="bm-title" placeholder="Title" value="${isEdit ? existingItem.title : ''}" required>
                    </div>
                    <div class="input-group">
                        <input type="url" id="bm-url" placeholder="URL" value="${isEdit ? existingItem.url : ''}" required>
                    </div>
                    <div class="input-group">
                        <select id="bm-cat">
                            <option value="">Select Category</option>
                            ${options}
                        </select>
                    </div>
                    <button type="submit" class="btn">${isEdit ? 'Save Changes' : 'Save'}</button>
                `;
                modalFormEl.onsubmit = async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('bm-title').value;
                    const url = document.getElementById('bm-url').value;
                    const categoryId = document.getElementById('bm-cat').value;
                    if (!categoryId) { showUserMessage('Please select a category'); return; }

                    if (isEdit) {
                        await updateBookmark(existingItem.id, { title, url, categoryId });
                    } else {
                        await addBookmark({ title, url, categoryId });
                    }

                    closeModal();
                    renderBookmarks(currentCategoryId);
                };
            });
        }
    }

    function closeModal() {
        modalEl.classList.remove('open');
    }
});
