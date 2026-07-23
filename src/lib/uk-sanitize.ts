// Speech recognition and the free-tier AI model occasionally leak common
// Russian words into otherwise-Ukrainian text (shared vocabulary roots,
// small-model imprecision). This is a best-effort dictionary fix, not a
// full translator — it only swaps whole-word matches for everyday
// planning vocabulary.
const RU_TO_UK: Record<string, string> = {
  сегодня: "сьогодні",
  сейчас: "зараз",
  потом: "потім",
  нужно: "потрібно",
  надо: "треба",
  спасибо: "дякую",
  пожалуйста: "будь ласка",
  конечно: "звичайно",
  хорошо: "добре",
  плохо: "погано",
  сделать: "зробити",
  сделай: "зроби",
  делать: "робити",
  работать: "працювати",
  работа: "робота",
  продать: "продати",
  позвонить: "подзвонити",
  звонить: "дзвонити",
  написать: "написати",
  прочитать: "прочитати",
  отправить: "надіслати",
  получить: "отримати",
  оплатить: "оплатити",
  заплатить: "заплатити",
  убрать: "прибрати",
  почистить: "почистити",
  постирать: "попрати",
  приготовить: "приготувати",
  поесть: "поїсти",
  покушать: "поїсти",
  спать: "спати",
  встреча: "зустріч",
  встретиться: "зустрітися",
  утром: "вранці",
  вечером: "ввечері",
  ночью: "вночі",
  днем: "вдень",
  неделя: "тиждень",
  билет: "квиток",
  поезд: "поїзд",
  самолет: "літак",
  почта: "пошта",
  посылка: "посилка",
  дом: "дім",
  деньги: "гроші",
  дело: "справа",
  дела: "справи",
  вопрос: "питання",
  ответ: "відповідь",
  помощь: "допомога",
  помочь: "допомогти",
  проверить: "перевірити",
  закончить: "закінчити",
  начать: "почати",
  продолжить: "продовжити",
  забыть: "забути",
  вспомнить: "згадати",
  узнать: "дізнатися",
  рассказать: "розповісти",
  спросить: "запитати",
  решить: "вирішити",
  взять: "взяти",
  отдать: "віддати",
  вернуть: "повернути",
  приехать: "приїхати",
  уехать: "виїхати",
  пойти: "піти",
  идти: "йти",
  ехать: "їхати",
  понедельник: "понеділок",
  вторник: "вівторок",
  четверг: "четвер",
  суббота: "субота",
  воскресенье: "неділя",
  завтрак: "сніданок",
  обед: "обід",
  ужин: "вечеря",
  уборка: "прибирання",
  стирка: "прання",
  семья: "сім'я",
  друзья: "друзі",
};

const PATTERN = new RegExp(`(?<![\\p{L}])(${Object.keys(RU_TO_UK).join("|")})(?![\\p{L}])`, "giu");

function matchCase(source: string, replacement: string): string {
  const firstChar = source[0];
  if (firstChar && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function sanitizeUkrainian(text: string): string {
  if (!text) return text;
  return text.replace(PATTERN, (match) => {
    const replacement = RU_TO_UK[match.toLowerCase()];
    return replacement ? matchCase(match, replacement) : match;
  });
}
