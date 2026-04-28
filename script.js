document.addEventListener('DOMContentLoaded', () => {
    // localStorage 安全包装：隐身模式 / 配额满 / 禁 cookie 时不抛异常
    const storage = {
        get(key) {
            try { return window.localStorage.getItem(key); } catch (e) { return null; }
        },
        set(key, value) {
            try { window.localStorage.setItem(key, value); return true; }
            catch (e) { console.warn('storage.set 失败:', key, e.name); return false; }
        },
        remove(key) {
            try { window.localStorage.removeItem(key); } catch (e) { /* noop */ }
        }
    };

    const woodfish = document.getElementById('woodfish');
    const stick = document.getElementById('stick');
    const sound = document.getElementById('woodfish-sound');
    const scoreElement = document.getElementById('score');
    const hitsElement = document.getElementById('hits');
    const totalScoreElement = document.getElementById('totalScore');
    const totalHitsElement = document.getElementById('totalHits');
    const autoButton = document.getElementById('autoButton');
    const totalStats = document.querySelector('.total-stats');
    const trendPanel = document.getElementById('trendPanel');
    const trendOverlay = document.getElementById('trendOverlay');
    const heatmapElement = document.getElementById('heatmap');
    const monthlyListElement = document.getElementById('monthlyList');
    const zenText = document.getElementById('zenText');

    // 音乐控制相关元素
    const backgroundMusic = document.getElementById('background-music');
    const volumeSlider = document.getElementById('volumeSlider');
    const musicItems = document.querySelectorAll('.music-item');
    const startMeditationBtn = document.getElementById('startMeditation');
    const musicPanel = document.querySelector('.music-panel');
    const autoKnockToggle = document.getElementById('autoKnockToggle');

    let currentMusic = storage.get('selectedMusic');
    let isMeditating = false;

    // 恢复已选择的音乐
    if (currentMusic) {
        backgroundMusic.src = currentMusic;
        const selectedItem = querySelectorByDataSrc(currentMusic);
        if (selectedItem) {
            selectedItem.classList.add('active');
        } else {
            // localStorage 里的 selectedMusic 已不在当前曲库，清掉避免污染状态
            currentMusic = null;
            storage.remove('selectedMusic');
        }

        // 如果有默认音乐，添加音符图标
        if (currentMusic && !autoButton.querySelector('.music-icon')) {
            const musicIcon = document.createElement('span');
            musicIcon.className = 'music-icon';
            musicIcon.textContent = '♪';
            autoButton.insertBefore(musicIcon, autoButton.firstChild);
        }
    }

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'music-panel-overlay';
    document.body.appendChild(overlay);

    // 初始化音量
    backgroundMusic.volume = volumeSlider.value / 100;

    // 音量控制
    volumeSlider.addEventListener('input', () => {
        backgroundMusic.volume = volumeSlider.value / 100;
    });

    // 显示音乐面板
    function showMusicPanel() {
        // 已有选中的音乐则恢复其 active 状态；不再自动选第一首污染 localStorage
        if (currentMusic) {
            const selectedItem = querySelectorByDataSrc(currentMusic);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }

            // 仅在梵音环绕开启时才尝试预播放
            if (canPlayMusic()) {
                backgroundMusic.src = currentMusic;
                backgroundMusic.play();
            }
        }

        musicPanel.classList.add('show');
        overlay.classList.add('show');
    }

    // 安全地按 data-src 查找音乐项，防止特殊字符破坏 selector
    function querySelectorByDataSrc(src) {
        for (const item of musicItems) {
            if (item.dataset.src === src) return item;
        }
        return null;
    }

    // 隐藏音乐面板
    function hideMusicPanel() {
        // 如果不是在冥想状态，停止音乐播放
        if (!isMeditating) {
            backgroundMusic.pause();
        }
        musicPanel.classList.remove('show');
        overlay.classList.remove('show');
    }

    // 音乐选择
    musicItems.forEach(item => {
        item.addEventListener('click', () => {
            const src = item.dataset.src;

            // 如果点击当前播放的音乐，则暂停
            if (currentMusic === src && !isMeditating) {
                backgroundMusic.pause();
                item.classList.remove('active');
                currentMusic = null;
                storage.remove('selectedMusic');
                // 移除音乐图标
                const musicIcon = autoButton.querySelector('.music-icon');
                if (musicIcon) {
                    musicIcon.remove();
                }
                return;
            }

            // 移除其他音乐的活动状态
            musicItems.forEach(i => i.classList.remove('active'));

            // 设置新的音乐
            currentMusic = src;
            backgroundMusic.src = src;
            item.classList.add('active');

            // 添加音乐图标（如果还没有）
            if (!autoButton.querySelector('.music-icon')) {
                const musicIcon = document.createElement('span');
                musicIcon.className = 'music-icon';
                musicIcon.textContent = '♪';
                autoButton.insertBefore(musicIcon, autoButton.firstChild);
            }

            // 保存选择到本地存储
            storage.set('selectedMusic', src);

            // 播放音乐
            if (canPlayMusic()) {
                backgroundMusic.play();
            }
        });
    });

    // 自动按钮点击事件
    autoButton.addEventListener('click', () => {
        if (isMeditating) {
            // 停止冥想
            isMeditating = false;
            autoButton.classList.remove('active');
            autoButton.querySelector('.button-text').textContent = '开始修行';
            backgroundMusic.pause();
            stopAutoHit();
        } else {
            showMusicPanel();
        }
    });

    // 开始冥想按钮点击事件
    startMeditationBtn.addEventListener('click', () => {
        if (!isMeditating) {
            // 开始冥想
            isMeditating = true;
            // 根据是否有音乐设置按钮状态
            if (currentMusic) {
                autoButton.className = 'auto-button active playing';
                if (canPlayMusic()) {
                    backgroundMusic.play();
                }
            } else {
                autoButton.className = 'auto-button active';
            }
            const buttonText = autoButton.querySelector('.button-text');
            if (buttonText) {
                buttonText.textContent = '结束修行';
            } else {
                console.warn('按钮文本元素不存在');
            }
            // 只有在开关打开的情况下才启动自动敲击
            if (autoKnockToggle.checked) {
                startAutoHit();
            }
        } else {
            // 结束冥想，恢复初始状态
            isMeditating = false;
            autoButton.className = 'auto-button';
            const buttonText = autoButton.querySelector('.button-text');
            if (buttonText) {
                buttonText.textContent = '开始修行';
            } else {
                console.warn('按钮文本元素不存在');
            }
            if (currentMusic) {
                backgroundMusic.pause();
            }
            stopAutoHit();
        }
        hideMusicPanel();
    });

    // 监听自动敲击开关的变化
    autoKnockToggle.addEventListener('change', () => {
        if (isMeditating) {
            if (autoKnockToggle.checked) {
                startAutoHit();
            } else {
                stopAutoHit();
            }
        }
    });

    // 监听梵音环绕关闭：清理本闭包内的音乐状态，避免与 index.html 内联脚本不一致
    const ambientSoundToggle = document.getElementById('ambientSoundToggle');
    if (ambientSoundToggle) {
        ambientSoundToggle.addEventListener('change', () => {
            if (!ambientSoundToggle.checked) {
                currentMusic = null;
                storage.remove('selectedMusic');
                musicItems.forEach(i => i.classList.remove('active'));
                const musicIcon = autoButton.querySelector('.music-icon');
                if (musicIcon) musicIcon.remove();
            }
        });
    }

    // 点击遮罩层关闭面板
    overlay.addEventListener('click', hideMusicPanel);

    // 自动敲击控制
    let autoHitInterval = null;

    function startAutoHit() {
        if (!autoHitInterval) {
            autoHitInterval = setInterval(hitWoodfish, 1000);
        }
    }

    function stopAutoHit() {
        if (autoHitInterval) {
            clearInterval(autoHitInterval);
            autoHitInterval = null;
        }
    }

    let hitCount = 0;
    let dailyData = (() => {
        try {
            return JSON.parse(storage.get('dailyData')) || {};
        } catch (e) {
            console.warn('dailyData 解析失败，已重置:', e);
            return {};
        }
    })();

    // 获取当前日期的函数
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 从localStorage加载总计数据
    let totalStoredHits = parseInt(storage.get('totalHits')) || 0;
    let totalStoredScore = parseInt(storage.get('totalScore')) || 0;

    // 获取今日数据
    function getTodayData() {
        const today = getCurrentDate();
        return dailyData[today] || { hits: 0, score: 0 };
    }

    // 更新显示
    const todayData = getTodayData();
    hitsElement.textContent = `今日敲击 ${todayData.hits} 棒`;
    scoreElement.textContent = `获得 ${todayData.score} 灵子`;
    totalHitsElement.textContent = `${totalStoredHits} 棒`;
    totalScoreElement.textContent = `${totalStoredScore} 灵子`;

    const blessings = [
        "法喜充满",
        "禅心安定",
        "慧灯常明",
        "六根清净",
        "菩提心坚",
        "行愿无尽",
        "般若常在",
        "自在随缘",
        "功德圆满",
        "福慧双修"
    ];

    // 更新每日数据
    function updateDailyData(hits, score) {
        const currentDate = getCurrentDate();
        if (!dailyData[currentDate]) {
            dailyData[currentDate] = { hits: 0, score: 0 };
        }
        dailyData[currentDate].hits = (dailyData[currentDate].hits || 0) + hits;
        dailyData[currentDate].score = (dailyData[currentDate].score || 0) + score;
        storage.set('dailyData', JSON.stringify(dailyData));
    }

    // 获取本月的日期数组
    function getCurrentMonthDays() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        // 获取当月第一天
        const firstDay = new Date(year, month, 1);
        // 获取下月第一天的前一天（即当月最后一天）
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        for (let date = firstDay; date <= lastDay; date.setDate(date.getDate() + 1)) {
            // 使用本地时间格式化日期
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            days.push(`${y}-${m}-${d}`);
        }

        return days;
    }

    // 渲染热力图
    function renderHeatmap() {
        const monthDays = getCurrentMonthDays();
        heatmapElement.innerHTML = '';

        monthDays.forEach(date => {
            const dayData = dailyData[date] || { hits: 0, score: 0 };
            const intensity = Math.min(5, Math.ceil(dayData.hits / 100)); // 每100次为一个等级
            const day = new Date(date).getDate();

            const dayElement = document.createElement('div');
            dayElement.className = 'heatmap-day';

            if (dayData.hits > 0) {
                dayElement.classList.add('has-data');
                dayElement.setAttribute('data-hits', intensity);
                dayElement.setAttribute('data-tooltip', `${dayData.hits}棒 · ${dayData.score}灵子`);
                dayElement.style.cursor = 'pointer';
            } else {
                dayElement.classList.add('no-data');
                dayElement.setAttribute('data-hits', '0');
                dayElement.style.cursor = 'default';
            }

            dayElement.textContent = day;
            heatmapElement.appendChild(dayElement);
        });
    }

    // 获取月份数据
    function getMonthlyData() {
        const months = {};

        Object.entries(dailyData).forEach(([date, data]) => {
            const monthKey = date.substring(0, 7); // 获取 YYYY-MM 格式
            if (!months[monthKey]) {
                months[monthKey] = {
                    hits: 0,
                    score: 0,
                    days: new Set() // 使用Set来统计天数
                };
            }
            months[monthKey].hits += data.hits;
            months[monthKey].score += data.score;
            months[monthKey].days.add(date);
        });

        // 转换Set为数量
        Object.values(months).forEach(month => {
            month.days = month.days.size;
        });

        return months;
    }

    // 渲染月度数据列表
    function renderMonthlyList() {
        const months = getMonthlyData();
        monthlyListElement.innerHTML = '';

        Object.entries(months)
            .sort((a, b) => b[0].localeCompare(a[0])) // 按月份倒序
            .forEach(([month, data]) => {
                const monthName = new Date(month + '-01').toLocaleString('zh-CN', { year: 'numeric', month: 'long' });
                const item = document.createElement('div');
                item.className = 'monthly-item';
                item.innerHTML = `
                    <span class="date">${monthName}</span>
                    <div class="monthly-stats">
                        <div class="stat-item">
                            <div class="stat-label">敲击天数</div>
                            <div class="stat-value">${data.days}天</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">总敲击</div>
                            <div class="stat-value">${data.hits}棒</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">总灵子</div>
                            <div class="stat-value">${data.score}</div>
                        </div>
                    </div>
                `;
                monthlyListElement.appendChild(item);
            });
    }

    // 总计统计区域点击事件
    totalStats.addEventListener('click', () => {
        trendPanel.classList.toggle('show');
        trendOverlay.classList.toggle('show');
        if (trendPanel.classList.contains('show')) {
            renderHeatmap();
            renderMonthlyList();
        }
    });

    // 点击遮罩层关闭面板
    trendOverlay.addEventListener('click', () => {
        trendPanel.classList.remove('show');
        trendOverlay.classList.remove('show');
    });

    // PWA shortcut: ?view=trend 自动打开趋势面板
    if (new URLSearchParams(location.search).get('view') === 'trend') {
        trendPanel.classList.add('show');
        trendOverlay.classList.add('show');
        renderHeatmap();
        renderMonthlyList();
    }

    // 显示禅修文字的函数
    function showZenText() {
        const now = Date.now();

        // 如果是第一次点击，不显示文字，只更新时间
        if (firstHit) {
            firstHit = false;
            lastZenTextTime = now;
            lastHitTime = now;
            return;
        }

        // 如果文字正在显示，不做任何操作
        if (isZenTextVisible) {
            return;
        }

        // 如果距离上次显示不到10秒，不显示
        if (now - lastZenTextTime < 10000) {
            return;
        }

        // 显示新的禅修文字
        const randomIndex = Math.floor(Math.random() * zenTexts.length);
        zenText.textContent = zenTexts[randomIndex];
        zenText.classList.add('show');
        isZenTextVisible = true;

        // 清除之前的定时器
        if (currentZenTextTimeout) {
            clearTimeout(currentZenTextTimeout);
        }

        // 8秒后淡出，并在淡出时更新lastZenTextTime
        currentZenTextTimeout = setTimeout(() => {
            zenText.classList.remove('show');
            isZenTextVisible = false;
            lastZenTextTime = Date.now(); // 在淡出时更新时间
        }, 8000);
    }

    function createBubble(text, isScore = true) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        // 随机选择气泡浮动方向
        const floatDirection = Math.random() < 0.5 ? 'float-left' : 'float-right';
        bubble.classList.add(floatDirection);

        bubble.textContent = isScore ? `+${text}灵子` : text;

        // 将气泡定位到木鱼上方
        const woodfishRect = woodfish.getBoundingClientRect();
        bubble.style.left = `${woodfishRect.left + woodfishRect.width / 2}px`;
        bubble.style.top = `${woodfishRect.top}px`;

        document.body.appendChild(bubble);

        // 动画结束后移除气泡
        setTimeout(() => {
            bubble.remove();
        }, 1000);
    }

    function updateScore(points) {
        const todayData = getTodayData();
        scoreElement.textContent = `获得 ${todayData.score + points} 灵子`;

        // 更新总计数据
        totalStoredScore += points;
        storage.set('totalScore', totalStoredScore);
        totalScoreElement.textContent = `${totalStoredScore} 灵子`;

        // 更新每日数据
        updateDailyData(0, points);

        // 如果趋势面板正在显示，则更新数据
        if (trendPanel.classList.contains('show')) {
            renderHeatmap();
            renderMonthlyList();
        }
    }

    function updateHits() {
        const todayData = getTodayData();
        hitsElement.textContent = `今日敲击 ${todayData.hits + 1} 棒`;

        // 更新总计数据
        totalStoredHits++;
        storage.set('totalHits', totalStoredHits);
        totalHitsElement.textContent = `${totalStoredHits} 棒`;

        // 更新每日数据
        updateDailyData(1, 0);

        // 如果趋势面板正在显示，则更新数据
        if (trendPanel.classList.contains('show')) {
            renderHeatmap();
            renderMonthlyList();
        }

        // 显示禅修文字
        showZenText();
    }

    woodfish.addEventListener('click', (e) => {
        e.preventDefault(); // 阻止点击事件
        if (isMeditating && !autoHitInterval) {
            hitWoodfish();
        }
    });
    woodfish.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 阻止触摸事件
        if (isMeditating && !autoHitInterval) {
            hitWoodfish();
        }
    });

    // 禅修文字数组
    const zenTexts = [
        "觉知是禅修的本质，不在追求宁静或喜悦。觉察当下，一切都会自然展开。",
        "保持觉知，不选择，不抗拒。让每一个当下的体验，都成为觉醒的契机。",
        "接纳一切如其本来的样子，包容愉悦与不适，这正是修行的深意。",
        "觉知让我们看到内心的执着，当我们以平等心观察时，执着自然松动。",
        "宁静与烦躁都是无常的，像云彩一样来来去去，而觉知的天空始终明净。",
        "超越对特定状态的追求，放下期待与评判，安住于纯粹的觉知之中。",
        "觉知是通向内在自由的道路，它让我们从习性的束缚中解脱，回归本然。",
        "回归本来的清明面目，一切妄念如水中倒影，不留痕迹地消散。",
        "真正的自由在于觉知当下，不执着过去，不期待未来，安住当下。",
        "让觉知指引我们，而非期待与目标。在单纯的觉知中，一切都完整而圆满。"
    ];

    let lastZenTextTime = 0; // 初始化为0
    let currentZenTextTimeout = null;
    let firstHit = true; // 标记是否是第一次点击
    let isZenTextVisible = false; // 标记文字是否正在显示
    let lastHitTime = Date.now(); // 记录上次敲击时间

    const buttonText = autoButton.querySelector('.button-text');

    function updateButtonText(text) {
        if (buttonText) {
            buttonText.textContent = text;
        }
    }

    function hitWoodfish() {
        // 播放音效
        sound.currentTime = 0;
        sound.play();

        // 添加木鱼缩小动画
        woodfish.classList.add('shrink');
        setTimeout(() => woodfish.classList.remove('shrink'), 100);

        // 木鱼棒动画
        stick.classList.add('hit');
        setTimeout(() => stick.classList.remove('hit'), 100);

        // 更新总敲击次数
        updateHits();

        // 计数并检查是否获得奖励
        hitCount++;
        if (hitCount >= 5) {
            hitCount = 0;

            // 70%概率显示祝福语
            if (Math.random() < 0.7) {
                const randomBlessing = blessings[Math.floor(Math.random() * blessings.length)];
                createBubble(randomBlessing, false);
            } else {
                const bonus = Math.floor(Math.random() * 3) + 1;
                createBubble(bonus);
                updateScore(bonus);
            }
        } else {
            // 无奖励时显示"棒"
            createBubble("棒", false);
        }
    }

    function canPlayMusic() {
        // 检查全局控制函数是否存在
        if (typeof window.shouldPlayMusic === 'function') {
            return window.shouldPlayMusic();
        }
        // 兜底检查，直接查找元素
        const ambientSoundToggle = document.getElementById('ambientSoundToggle');
        return ambientSoundToggle && ambientSoundToggle.checked;
    }
});
