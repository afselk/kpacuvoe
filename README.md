# kpacuvoe

Меню-бар приложение для Mac: кидаешь скрины в папку — они сами обрамляются (скругление, паддинг, тень). Оригинал заменяется готовым PNG.

**По умолчанию:** непрозрачный фон · скругление `30px` · padding `30px` · размытие тени `30px`.

---

## Assets

Скачай сборку под свой Mac и поставь как обычное приложение:

| Файл | Для кого | Что делать |
|------|----------|------------|
| [**kpacuvoe-1.1.0-arm64-mac.zip**](https://github.com/afselk/kpacuvoe/releases/latest/download/kpacuvoe-1.1.0-arm64-mac.zip) | Apple Silicon (M1–M4) | Распаковать → перетащить `kpacuvoe.app` в **Applications** |
| [**kpacuvoe-1.1.0-mac.zip**](https://github.com/afselk/kpacuvoe/releases/latest/download/kpacuvoe-1.1.0-mac.zip) | Intel Mac | То же самое |

Все релизы: [Releases](https://github.com/afselk/kpacuvoe/releases)

### Установка

1. Скачай zip из таблицы выше  
2. Распакуй → перетащи **kpacuvoe.app** в **Applications**  
3. Сними карантин Gatekeeper (иначе macOS пишет *«damaged and can't be opened»* — это не поломка файла):

```bash
xattr -cr /Applications/kpacuvoe.app
```

4. Запусти `kpacuvoe` из Applications  
5. Иконка сядет в **строку меню** → **Выбрать папку…**

Дальше просто кидай фото/скрины в эту папку — kpacuvoe обработает и заменит файл.

> Сборка без Apple notarization. Сообщение «is damaged» = карантин на скачанном файле, лечится командой выше.
>
> Дальше обновления ставятся из приложения: **Настройки → Обновить** (или пункт в трее).

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
