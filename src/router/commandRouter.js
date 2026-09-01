

export const commandRouter = (userInput) => {

    const input = userInput.toLowerCase().trim()

    let action;
    let target;


    if(input.startsWith("open ")){

        action= "open"
        target = input.split(" ").slice(1).join(" ")

    }else if(input.startsWith("launch ")){
        action = "launch"
        target = input.split(" ").slice(1).join(" ")

    }else if(input.startsWith("start ")){
        action = "start"
        target = input.split(" ").slice(1).join(" ")


    }

    if(!action) {
        return null;
    }

    return {action, target}



}