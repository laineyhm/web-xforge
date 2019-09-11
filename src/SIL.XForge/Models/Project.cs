using System.Collections.Generic;

namespace SIL.XForge.Models
{
    public abstract class Project : Json0Snapshot
    {
        public string Name { get; set; }
        public InputSystem InputSystem { get; set; } = new InputSystem();
        public Dictionary<string, string> UserRoles { get; set; } = new Dictionary<string, string>();
    }
}
