# kpacuvoe

Меню-бар приложение для Mac: кидаешь скрины в папку — они сами обрамляются (скругление, паддинг, тень). Оригинал заменяется готовым PNG.

**По умолчанию:** непрозрачный фон · скругление `30px` · padding `30px` · размытие тени `30px`.

---

## Assets

Скачай сборку под свой Mac и поставь как обычное приложение:

| Файл | Для кого | Что делать |
|------|----------|------------|
| [**kpacuvoe-1.0.0-arm64-mac.zip**](https://github.com/afselk/kpacuvoe/releases/latest/download/kpacuvoe-1.0.0-arm64-mac.zip) | Apple Silicon (M1–M4) | Распаковать → перетащить `kpacuvoe.app` в **Applications** |
| [**kpacuvoe-1.0.0-mac.zip**](https://github.com/afselk/kpacuvoe/releases/latest/download/kpacuvoe-1.0.0-mac.zip) | Intel Mac | То же самое |

Все релизы: [Releases](https://github.com/afselk/kpacuvoe/releases)

### Установка за 30 секунд

1. Скачай zip из таблицы выше  
2. Распакуй — появится **kpacuvoe.app**  
3. Перетащи в **Applications**  
4. Первый запуск: правый клик → **Open** (приложение пока без Apple notarization)  
5. Иконка сядет в **строку меню** → **Выбрать папку…**

Дальше просто кидай фото/скрины в эту папку — kpacuvoe обработает и заменит файл.

---

## Что умеет

- Висит в трее (без иконки в Dock)
- Следит за выбранной папкой, обрабатывает уже лежащие и новые файлы
- Режимы: **тень** (по умолчанию) или **градиент** из палитры кадра
- Настройки из трея: скругление, паддинг, обводка, blur

В папке появляется служебный `.kpacuvoe.json` — чтобы не накручивать рамку повторно.

---

## Разработка

```bash
npm install
npm run dev:app    # Vite + Electron
npm run dist:mac   # сборка .app / zip / dmg (dmg — только на macOS)
```

На Mac можно собрать `.dmg`:

```bash
./scripts/make-dmg-on-mac.sh
```
