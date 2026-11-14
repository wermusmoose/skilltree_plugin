export const emojiNames: Record<string,string> = Object.fromEntries(`
😀|улыбка smile grin
😃|радость happy smile
😄|смех радость laugh smile
😁|улыбка grin
😆|смех laugh
😅|пот sweat smile
😂|слезы смех tears joy laugh
🙂|улыбка smile
🙃|перевернутый upside down
😉|подмигивание wink
😊|смущение улыбка blush smile
😍|влюбленность любовь heart eyes love
😎|очки крутой sunglasses cool
🤔|думать мысль thinking
😴|сон спать sleep
😭|плач слезы cry tears
😡|злость angry rage
🤯|взрыв головы exploding head
🥳|праздник party
👋|привет рука wave hand
👍|палец вверх хорошо thumbs up like
👎|палец вниз плохо thumbs down dislike
🙏|спасибо молитва pray thanks
💪|мышцы сила muscle strong
👀|глаза eyes
🧠|мозг brain
👨‍💻|программист мужчина developer programmer man technologist
👩‍💻|программист женщина developer programmer woman technologist
🏃|бег runner running
🧘|медитация йога meditation yoga
👑|корона crown
🌱|росток seedling sprout
🌿|трава herb leaf
🌳|дерево tree
🌲|ель сосна evergreen pine tree
🌸|цветок сакура blossom flower
🌻|подсолнух sunflower
🍀|клевер удача clover luck
🌍|земля мир earth world
☀️|солнце sun
🌙|луна moon
⭐|звезда star
🔥|огонь fire flame
💧|капля вода drop water
❄️|снежинка снег snowflake snow
🐶|собака пес dog puppy
🐱|кот кошка cat kitten
🦊|лиса fox
🐻|медведь bear
🦋|бабочка butterfly
🐝|пчела bee
🫎|лось moose elk
🦌|олень deer
🍎|яблоко apple
🍊|апельсин мандарин orange tangerine
🍋|лимон lemon
🍉|арбуз watermelon
🍇|виноград grapes
🍓|клубника strawberry
🥕|морковь carrot
🍕|пицца pizza
🍔|бургер hamburger burger
🍰|торт cake
☕|кофе coffee
🍵|чай tea
💻|ноутбук компьютер laptop computer
🖥️|монитор компьютер desktop monitor computer
📱|телефон smartphone phone
⚙️|шестеренка настройки gear settings
🔧|ключ инструмент wrench tool
🔨|молоток hammer
💡|лампочка идея bulb idea
📚|книги books
📓|тетрадь notebook
📝|заметка карандаш memo note pencil
📎|скрепка paperclip
📁|папка folder
📦|коробка посылка package box
🔑|ключ key
💰|деньги money
🎨|краски палитра искусство palette art
🎵|музыка нота music note
🎮|игра геймпад game controller
⚽|футбол soccer football
🏀|баскетбол basketball
🎾|теннис tennis
🏆|кубок trophy
🥇|медаль первое место medal gold
🚲|велосипед bicycle bike
🚗|машина автомобиль car
✈️|самолет plane airplane
🚀|ракета rocket
🏠|дом house home
⛰️|гора mountain
🏖️|пляж beach
✅|готово выполнено галочка check done
❌|крестик нет cross no
❓|вопрос question
❗|восклицание важно exclamation important
⚠️|предупреждение warning
❤️|красное сердце любовь red heart love
💛|желтое сердце yellow heart
💚|зеленое сердце green heart
💙|синее сердце blue heart
💜|фиолетовое сердце purple heart
🎯|цель target
📌|кнопка закрепить pin
🔗|ссылка цепь link chain
🔒|закрытый замок lock
🔓|открытый замок unlock
➕|плюс plus
➖|минус minus
➡️|стрелка вправо arrow right
🔄|обновить повторить refresh repeat
`.trim().split('\n').map(line=>line.split('|')));
export const normalizeEmojiQuery=(s:string)=>s.trim().toLocaleLowerCase().replaceAll('ё','е');
export function matchesEmoji(emoji:string,category:string,query:string){const q=normalizeEmojiQuery(query);return !q||normalizeEmojiQuery(category+' '+(emojiNames[emoji]??'')+' '+emoji).includes(q);}
// Keep whole grapheme clusters: family ZWJ sequences, skin tones, flags and keycaps.
export function pastedEmoji(text:string):string|null {
 const value=text.trim();if(!value||value.length>64)return null;
 const parts=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value));
 return parts.length===1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(value)?value:null;
}
