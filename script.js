document.addEventListener('DOMContentLoaded', () => {
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
    const dailyListElement = document.getElementById('dailyList');
    const zenText = document.getElementById('zenText');
    
    // 音乐控制相关元素
    const backgroundMusic = document.getElementById('background-music');
    const musicToggle = document.getElementById('musicToggle');
    const volumeSlider = document.getElementById('volumeSlider');
    const musicItems = document.querySelectorAll('.music-item');
    
    let currentMusic = null;
    let isPlaying = false;

    // 禅修文字数组
    const zenTexts = [
        "觉知是禅修的本质，不在追求宁静或喜悦。单纯地觉察当下，一切都会自然展开。",
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
    
    // 初始化音量
    backgroundMusic.volume = volumeSlider.value / 100;

    // 音量控制
    volumeSlider.addEventListener('input', () => {
        backgroundMusic.volume = volumeSlider.value / 100;
    });

    // 音乐切换
    musicItems.forEach(item => {
        item.addEventListener('click', () => {
            const src = item.dataset.src;
            const musicPanel = document.querySelector('.music-panel');
            
            // 如果点击当前播放的音乐，则暂停
            if (currentMusic === src && isPlaying) {
                backgroundMusic.pause();
                isPlaying = false;
                musicToggle.classList.remove('playing');
                item.classList.remove('active');
                musicPanel.classList.remove('show-panel');
                return;
            }
            
            // 移除其他音乐的活动状态
            musicItems.forEach(i => i.classList.remove('active'));
            
            // 设置新的音乐
            backgroundMusic.src = src;
            backgroundMusic.play().then(() => {
                isPlaying = true;
                currentMusic = src;
                musicToggle.classList.add('playing');
                item.classList.add('active');
                musicPanel.classList.add('show-panel');
            }).catch(error => {
                console.error('播放失败:', error);
            });
        });
    });

    // 音乐开关控制
    musicToggle.addEventListener('click', () => {
        const musicPanel = musicToggle.closest('.music-panel');
        
        if (!currentMusic) {
            // 如果没有选择音乐，默认播放第一首
            musicPanel.classList.add('show-panel');
            const firstItem = musicItems[0];
            firstItem.click();
        } else {
            if (isPlaying) {
                backgroundMusic.pause();
                musicToggle.classList.remove('playing');
                document.querySelector('.music-item.active')?.classList.remove('active');
                musicPanel.classList.remove('show-panel');
            } else {
                musicPanel.classList.add('show-panel');
                backgroundMusic.play();
                musicToggle.classList.add('playing');
                document.querySelector('.music-item[data-src="' + currentMusic + '"]')?.classList.add('active');
            }
            isPlaying = !isPlaying;
        }
    });

    // 点击页面其他地方关闭面板
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.music-panel')) {
            document.querySelector('.music-panel')?.classList.remove('show-panel');
        }
    });

    let score = 0;
    let hitCount = 0;
    let totalHits = 0;
    let autoHitInterval = null;
    let dailyData = JSON.parse(localStorage.getItem('dailyData')) || {};

    // 获取当前日期的函数
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 从localStorage加载总计数据
    let totalStoredHits = parseInt(localStorage.getItem('totalHits')) || 0;
    let totalStoredScore = parseInt(localStorage.getItem('totalScore')) || 0;

    // 更新显示
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
        localStorage.setItem('dailyData', JSON.stringify(dailyData));
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

    // 渲染每日数据列表（懒加载）
    function renderDailyList() {
        const dates = Object.keys(dailyData).sort().reverse();
        dailyListElement.innerHTML = '';
        
        dates.slice(0, 10).forEach(date => { // 初始只显示10天
            const data = dailyData[date];
            const item = document.createElement('div');
            item.className = 'daily-item';
            item.innerHTML = `
                <span class="date">${date}</span>
                <div class="stats">
                    <span>${data.hits} 棒</span>
                    <span>${data.score} 灵子</span>
                </div>
            `;
            dailyListElement.appendChild(item);
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

    // 初始化标签页切换
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有活动状态
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            // 添加新的活动状态
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId + 'List').classList.add('active');
            
            // 如果是月度数据，重新渲染
            if (tabId === 'monthly') {
                renderMonthlyList();
            }
        });
    });

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
        bubble.style.left = `${woodfishRect.left + woodfishRect.width/2}px`;
        bubble.style.top = `${woodfishRect.top}px`;
        
        document.body.appendChild(bubble);
        
        // 动画结束后移除气泡
        setTimeout(() => {
            bubble.remove();
        }, 1000);
    }

    function updateScore(points) {
        score += points;
        scoreElement.textContent = `获得 ${score} 灵子`;
        
        // 更新总计数据
        totalStoredScore += points;
        localStorage.setItem('totalScore', totalStoredScore);
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
        totalHits++;
        hitsElement.textContent = `本次敲击 ${totalHits} 棒`;
        
        // 更新总计数据
        totalStoredHits++;
        localStorage.setItem('totalHits', totalStoredHits);
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

    woodfish.addEventListener('click', hitWoodfish);
    woodfish.addEventListener('touchstart', (e) => {
        e.preventDefault();
        hitWoodfish();
    });

    // 自动敲击功能
    autoButton.addEventListener('click', () => {
        if (autoHitInterval) {
            // 关闭自动敲击
            clearInterval(autoHitInterval);
            autoHitInterval = null;
            autoButton.classList.remove('active');
        } else {
            // 开启自动敲击
            autoHitInterval = setInterval(hitWoodfish, 1000);
            autoButton.classList.add('active');
        }
    });
});
