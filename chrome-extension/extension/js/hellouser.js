document.addEventListener('DOMContentLoaded', function() {
    var access_token = localStorage.accessToken;
    if (access_token == undefined) {
        document.getElementById("msg").innerText = "There was a problem signing you in. Please try again.";
        return
    }
    var url = "https://graph.facebook.com/me?fields=id,name,email&access_token=" + access_token;
    $.get(url, function( data ) {
        localStorage.email = data.email;
        localStorage.id = data.id;
        localStorage.name = data.name;

        document.getElementById("msg").innerText = "Welcome, " + localStorage.name;

        // make API call to server
        var server_url = "http://ec2-54-236-125-44.compute-1.amazonaws.com/api/register";
        $.ajax({
            type: "POST",
            url: server_url,
            data: {
                "fbid": localStorage.id,
                "email": localStorage.email
            },
            success: function(data) {
                console.log("User logged in", data);
            }
        });
    });
});
